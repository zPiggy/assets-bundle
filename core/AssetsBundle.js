
var path = require("path");
var fs = require("fs");
var FsExtra = require("fs-extra");

var AssetsDB = require("./AssetsDB");
var HotUpdateBuilder = require("./HotUpdateBuilder");
var Config = require("../Config");
var FsUtils = require("./FsUtils");


module.exports = {
    /**@type Subpackages*/
    subpackages: null,
    buildRoot: "",
    /**@type {PlugConfig} */
    plugConfig: null,

    subpackagesPath: "",

    /**
     * 
     * @param {PlugConfig} plugConfig 插件配置信息
     * @param {string} buildDest 编译目录
     * @param {Subpackages} subpackages 引擎构建后生成的子包对象
     */
    init(plugConfig, buildDest, subpackages) {
        this.plugConfig = plugConfig;
        this.buildRoot = buildDest;
        this.subpackages = subpackages;

        this.subpackagesPath = path.join(buildDest, Config.SUBPACKAGES);

        Editor.log("编译路径: " + buildDest);
        Editor.log("项目子包配置: " + Object.keys(subpackages));
        Editor.log("项目子包目录: " + this.subpackagesPath);
        // 移除打包目录下所有子包

    },

    async check() {
        let subpackArr = this.plugConfig.subpackArr;
        if (subpackArr.length != Object.keys(this.subpackages).length) {
            Editor.error("子包配置异常::请检查项目子包配置和插件子包配置是否一致");
            Editor.log("当前项目子包: ", Object.keys(this.subpackages));
            return false;
        }
        if (await this.checkPrivate(subpackArr) === false) {
            return false;
        }

        return true;
    },
    /**
     * 执行打包
     * @param {AutoAtlasInfo} autoAtlasInfo 子包自动图集信息
     */
    async run(autoAtlasInfo = {}) {
        try {
            let packs = this.plugConfig.subpackArr;
            let isDebug = this.plugConfig.isDebug;
            let saveDir = path.join(Editor.Project.path, this.plugConfig.packageSaveDir);
            let packageUrl = this.plugConfig.mainPack.packageUrl;
            packs.length && Editor.success("开始打包子包资源");
            for (let i = 0; i < packs.length; i++) {
                let pack = packs[i];
                let type = packs[i].type;
                // ${project}/HotUpdate/xxx | ${project}/HotUpdate/xxx/Debug
                let destDir = path.join(saveDir, pack.name, isDebug ? Config.DEBUG_DIR : "");
                Editor.log("目标目录: " + destDir);
                // 清空该子包的热更目录
                FsUtils.clearDirSync(destDir);
                // FsExtra.removeSync(destDir);
                if (type === "LOCAL") {
                    await this.clearPackage(pack.name);
                    continue;
                }

                Editor.log("========== " + pack.name + " ==========");
                // 为子包填入主包的远程资源地址;
                pack.packageUrl = packageUrl;

                await this.pickAssets(pack, this.buildRoot, destDir, type === "REMOTE" ? "move" : "copy", autoAtlasInfo[pack.name]);
                await HotUpdateBuilder.build(destDir, pack, isDebug);

            }

            Editor.success("开始打包主包资源");
            await this.sleep(2000);
            let destDir = path.join(saveDir, this.plugConfig.mainPack.name, isDebug ? Config.DEBUG_DIR : "")
            // 清空主包的热更目录
            FsUtils.clearDirSync(destDir);
            // FsExtra.removeSync(destDir);
            this.pickMainAssets(this.buildRoot, destDir);
            await HotUpdateBuilder.build(destDir, this.plugConfig.mainPack, isDebug);

        } catch (error) {
            Editor.error(error);
        }
    },

    /**
     * 检验子包资源私有性 (无法校验脚本的相互引用关系)
     * @param {Package[]} subpackArr
     */
    async checkPrivate(subpackArr = []) {

        let isOK = true;

        let st = new Date().getTime();

        // TODO:这里可能存在性能问题
        for (let i = 0; i < subpackArr.length; i++) {
            let resDirs = subpackArr[i].resDirs;
            if (resDirs && resDirs.length) {
                let dependsMap = Object.create(null);

                // 相对路径转 url 
                let urls = [];
                for (let j = 0; j < resDirs.length; j++) {
                    let rPath = resDirs[j];
                    if (rPath) {
                        let url = AssetsDB.getUrlByRelativepath(rPath);
                        urls.push(url);
                        url += "/**/*";
                        await AssetsDB.getDependsRecursively(url, "", dependsMap, Config.ScriptType);
                    }
                }

                // 查找出当前分包引用的所有外部资源
                /**@type {string[]} */
                let extUrls = [];
                for (var uuid in dependsMap) {
                    let url = AssetsDB.mainAssetdb.uuidToUrl(uuid);
                    for (let j = 0; j < urls.length; j++) {
                        if (url.indexOf(urls[j]) !== 0) {   // 资源和资源根目录不匹配 属于引用外部资源
                            extUrls.push(url);
                        }
                    }
                }

                let errUrls = [];
                // 检验外部资源中是否引用其他私有分包资源
                for (let j = 0; j < extUrls.length; j++) {
                    for (let k = 0; k < subpackArr.length; k++) {
                        // 跳过当前包和非私有包
                        if (k == i || subpackArr[k].isPrivate == false) {
                            continue;
                        }
                        let resDirs = subpackArr[k].resDirs;
                        if (resDirs && resDirs.length) {
                            resDirs.forEach((rPath) => {
                                let url = AssetsDB.getUrlByRelativepath(rPath);
                                // 修复 目录相似时造成的识别问题: /xx/xxx/aabb 与 /xx/xxx/aab 相似
                                url = url.endsWith("/") ? url : url + "/";
                                // Editor.log(extUrls[j], url);
                                if (extUrls[j].startsWith(url)) {
                                    errUrls.push(extUrls[j]);
                                }
                            })
                        }
                    }
                }

                // 输出日志
                if (errUrls.length) {
                    isOK = false;
                    Editor.log("子包 " + subpackArr[i].name + " 引用以下私有资源:: ", JSON.stringify(errUrls, null, 2));
                }
            }
        }

        Editor.log("校验资源耗时: " + (new Date().getTime() - st) + "ms");

        return isOK;
    },

    /**
     * 收集子包资源到目标目录
     * @param {Package} pack
     * @param {string} buildRoot ${project}/build/jsb-default
     * @param {string} destDir ${project}/HotUpdate/xxx
     * @param {"copy" | "move"} options 
     * @param {SubpackageAutoAtlasInfo} autoAtlasInfo 子包自动图集信息
     */
    async pickAssets(pack, buildRoot, destDir, options = "copy", autoAtlasInfo) {
        let resDirs = pack.resDirs;
        // 1.收集子包资源目录下的所有 json 资源
        let uuids = [];
        for (let i = 0; i < resDirs.length; i++) {
            if (resDirs[i]) {
                let url = AssetsDB.getExistUrlByRelativepath(resDirs[i]);
                if (!url) {
                    Editor.error("找不到目录: " + resDirs[i]);
                    continue;
                }
                // 收集除脚本目录以外的所有资源 
                let assets = await AssetsDB.getAssets(url + "/**/*", "", Config.ScriptType.concat("folder"));
                let _uuids = assets.map((asset, index) => {
                    return asset.uuid;
                });

                uuids = uuids.concat(_uuids);
            }
        }
        let autoAtlasContains = {};
        // 追加自动图集uuid
        if (autoAtlasInfo) {
            uuids = uuids.concat(autoAtlasInfo.uuids || []);
            autoAtlasContains = autoAtlasInfo.containsSubAssets || {};
            // Editor.log("自动图集信息::", autoAtlasInfo.uuids, autoAtlasInfo.containsSubAssets);
        }

        for (let j = 0; j < uuids.length; j++) {
            var uuid = uuids[j];
            let rPath = this.getBuildImportPath(uuid);
            let file = path.join(buildRoot, rPath);

            if (rPath == "" || fs.existsSync(file) == false || fs.statSync(file).isFile() == false) {
                // 追加 排除自动图集uuid
                if (!autoAtlasContains[uuid]) {
                    file = AssetsDB.mainAssetdb.uuidToUrl(uuid);    // 转成能看懂的文件
                    Editor.log("构建资源中不存在文件(可能未参与构建): " + file);
                }
                continue;
            }
            let destFile = path.join(destDir, rPath);
            if (options === "move") {
                FsUtils.moveFileSync(file, destFile);
                // FsExtra.moveSync(file, destFile, { overwrite: true });
            }
            else {
                FsUtils.copyFileSync(file, destFile);
                // FsExtra.copySync(file, destFile);
            }
        }

        // 2.收集 subpackages 目录下的原生资源
        let packDir = path.join(Config.SUBPACKAGES, pack.name);
        let srcDir = path.join(buildRoot, packDir);
        let destDir2 = path.join(destDir, packDir);
        if (options === "move") {
            FsUtils.moveDirSync(srcDir, destDir2);
            // FsExtra.moveSync(srcDir, destDir2);
        }
        else {
            FsUtils.copyDirSync(srcDir, destDir2);
            // FsExtra.copySync(srcDir, destDir2);
        }

    },

    /**
     * 收集主包资源到目标目录(目录拷贝)
     * @param {string} srcDir build/jsb-default
     * @param {string} destDir ${project}/HotUpdate/xxxx
     */
    pickMainAssets(srcDir, destDir) {
        let srcPath = path.join(srcDir, "src");
        let resPath = path.join(srcDir, "res");
        let subPath = path.join(srcDir, "subpackages");

        let destSrc = path.join(destDir, "src");
        let destRes = path.join(destDir, "res");
        let destSub = path.join(destDir, "subpackages");

        if (fs.existsSync(srcPath)) {
            FsUtils.copyDirSync(srcPath, destSrc);
        }
        if (fs.existsSync(resPath)) {
            FsUtils.copyDirSync(resPath, destRes);
        }
        if (fs.existsSync(subPath)) {
            FsUtils.copyDirSync(subPath, destSub);
            // FsExtra.copySync(subPath, destSub);
        }

    },

    /**
     * 获取资源的import的相对路径
     * 
     * @param {string} uuid 
     * @requires {"res/import/xx/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json"}
     */
    getBuildImportPath(uuid) {
        // 追加 自动图集9位uuid 的处理
        if (AssetsDB._isUuid(uuid) || uuid.length == 9) {
            let preDir = uuid.substr(0, 2);
            let file = uuid + ".json";
            return path.join("res/import", preDir, file);
        }
        Editor.error("无效的uuid: " + uuid);
        return "";
    },




    /**
     * 清除一个子包的相关目录
     */
    async clearPackage(packName) {
        // 1.移除项目中的子包清单文件
        let manifestDirUrl = Config.MANIFEST_DIR_URL + "/" + packName + "/";
        if (AssetsDB.mainAssetdb.exists(manifestDirUrl)) {
            await AssetsDB.delete([manifestDirUrl]);
        }
    },

    /**
     * 暂停
     * @param {number} time 毫秒
     * @returns undefined
     */
    async sleep(time) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, time);
        })
    }

}