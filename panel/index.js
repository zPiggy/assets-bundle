var fs = require('fs');
var path = require('path');
/** @type {typeof import("../core/AssetsDB")}; */
var AssetDB = Editor.require('packages://assets-bundle/core/AssetsDB.js');
/** @type {typeof import("../core/HotUpdateBuilder")} */
const HotUpdateBuilder = Editor.require('packages://assets-bundle/core/HotUpdateBuilder.js');
/**@type {typeof import("../core/AssetsBundle")} */
var AssetsBundle = Editor.require('packages://assets-bundle/core/AssetsBundle.js');
/**@type {typeof import("../Config")} */
var Config = Editor.require('packages://assets-bundle/Config.js');
/**@type {typeof import("../core/FsUtils")} */
var FsUtils = Editor.require('packages://assets-bundle/core/FsUtils.js');


/**
 * 子包类型
 */
var PackageType = {
    /**@type {"LOCAL"} */
    LOCAL: "LOCAL",
    /**@type {"HOT_UPDATE"} */
    HOT_UPDATE: "HOT_UPDATE",
    /**@type {"REMOTE"} */
    REMOTE: "REMOTE"
}

Editor.Panel.extend({
    dependencies: [

    ],

    style: fs.readFileSync(Editor.url('packages://assets-bundle/panel/index.css', 'utf8')) + "",
    template: fs.readFileSync(Editor.url('packages://assets-bundle/panel/index.html', 'utf8')) + "",


    // method executed when template and styles are successfully loaded and initialized
    ready() {
        Editor.log("assets-bundle: 插件加载成功");
        this.vue = new window.Vue({
            el: this.shadowRoot,
            init: function () {
            },
            // 初始化面板数据
            created: function () {
                // 读取配置文件
                let config = Config.read();
                if (config) {
                    this.mainPack = config.mainPack;
                    this.subpackArr = config.subpackArr;
                    this.packageSaveDir = config.packageSaveDir;
                    this.isDebug = config.isDebug;
                    this.buildWithCheck = config.buildWithCheck;
                }

            },
            data: {
                /**资源打包保存路径（相对路径） */
                packageSaveDir: "HotUpdate/GameX",
                /**@type {Package} */
                mainPack: {
                    name: "Main",
                    zhName: "主包",
                    version: "1.0.0",
                    packageUrl: "http://127.0.0.1/GameX",
                    zipImport: true,
                    zipRawassets: false,
                    isPrivate: false,
                    type: "HOT_UPDATE",
                    // resDirs: [],
                },
                /**
                 * 子包数组
                 * @type Package[]
                 * */
                subpackArr: [],
                isDebug: false,
                buildWithCheck: true,

                searchStr: "",
            },

            methods: {
                async onBuildStart() {
                    await this.setAllSubpack();
                },
                onBuildFinished() {

                },

                async setAllSubpack() {
                    Editor.log("=============  开始设置子包  =============");
                    for (let i = 0; i < this.subpackArr.length; i++) {
                        const pack = this.subpackArr[i];
                        await this.setSubpack(pack);
                    }
                    Editor.log("=============  完成设置子包  =============");

                },

                /**
                 * 根据配置在项目中设置子包
                 */
                async setSubpack(pack) {
                    let dirs = pack.resDirs;
                    let packName = pack.name;
                    let _logstr = packName + ":: ";
                    for (let i = 0; i < dirs.length; i++) {
                        dirs[i] = dirs[i].replace(/\/$/, "");// 去除末尾的 /
                        if (dirs[i]) {
                            _logstr += dirs[i] + ", ";
                            let data = await AssetDB.getMetaInfoByUrl(dirs[i]);
                            if (data && data.json) {
                                let meta = JSON.parse(data.json);
                                // 仅设置未设置的目录
                                if (meta.isSubpackage == false || meta.subpackageName != packName) {
                                    meta.isSubpackage = true;
                                    meta.subpackageName = packName;
                                    let json = JSON.stringify(meta, null, 2);
                                    // console.log(meta);
                                    Editor.assetdb.saveMeta(meta.uuid, json);
                                }
                            }
                        }
                    }
                    Editor.log(_logstr);

                },

                /**
                 * 移除所有项目中的子包配置
                 * 对于大型资源项目 此方法可能有性能问题
                 * 不建议每次构建前调用, 而是需要时手动调用
                 */
                async removeAllSubpack() {
                    Editor.log("=============  开始移除子包  =============");
                    // let _logArr = [];
                    let folders = await AssetDB.getAssetsFolders();
                    for (let i = 0; i < folders.length; i++) {
                        let uuid = folders[i].uuid;
                        let url = folders[i].url;
                        let data = await AssetDB.getMetaInfoByUrl(url);
                        if (data && data.json) {
                            let meta = JSON.parse(data.json);
                            if (meta.isSubpackage) {
                                // _logArr.push(url);
                                let name = meta.subpackageName || path.basename(url);
                                Editor.log(name + ":: " + url);
                                meta.isSubpackage = false;
                                Editor.assetdb.saveMeta(uuid, JSON.stringify(meta, null, 2));
                            }
                        }
                    }
                    Editor.log("=============  完成移除子包  =============");

                },

                ////////////////////////////////////
                /**追加一个子包配置 */
                addSubpack() {
                    this.subpackArr.push({
                        name: "GG1",
                        zhName: "游戏1",
                        version: "0.0.1",
                        // packageUrl: this.mainPack.packageUrl,    // 废弃 共享主包的同名属性
                        zipImport: true,
                        zipRawassets: false,
                        isPrivate: true,  // 默认子包都是私有的
                        type: PackageType.LOCAL,
                        resDirs: [""],  //资源路径
                    });
                },
                /**删除一个子包配置 */
                delSubpack(index) {
                    if (confirm("确认要删除 子包 " + this.subpackArr[index].name + " 吗?") === true) {
                        this.subpackArr.splice(index, 1);
                    }
                },
                /**添加一个资源目录 */
                addResDir(pack) {
                    pack.resDirs.push("");
                },
                /**删除一个资源目录 */
                delResDir(pack, index) {
                    if (confirm("确认删除 资源目录\n" + pack.resDirs[index]) === true) {
                        pack.resDirs.splice(index, 1);
                    }
                },
                onOpenDir(rPath) {
                    let fullpath = path.join(Editor.Project.path, rPath);
                    FsUtils.openDir(fullpath);
                },
                onSelectSubResDir(resDirs, index) {
                    var dir = FsUtils.selectDir();
                    if (dir) {
                        // 获取相对路径
                        dir = FsUtils.getRelativePath(dir);
                        // 转linux路径
                        dir = dir.replace(/\\/g, "/");

                        resDirs.splice(index, 1, dir);  //解决arr[index] = newValue时  Vue无法检测到更新问题
                    }

                },
                /**
                 * 为远程子包生成初始化清单文件
                 */
                async genInitSubPackManifest() {
                    let rootUrl = Config.MANIFEST_DIR_URL;
                    // 1.移除 rootDir 下所有子包清单配置信息
                    Editor.remote.assetdb.exists(rootUrl) && Editor.assetdb.delete([rootUrl]);
                    let flag = true;
                    // 2.导入 所有远程子包清单
                    this.subpackArr.forEach(async (pack) => {
                        // 远程子包
                        if (pack.type == PackageType.REMOTE) {
                            if (flag) {
                                flag = false;
                                await AssetDB.create(rootUrl);
                            }
                            let newPack = JSON.parse(JSON.stringify(pack));
                            newPack.packageUrl = this.mainPack.packageUrl;
                            let manifest = HotUpdateBuilder.generateEmptyManifest(newPack, this.isDebug);
                            // 创建目录
                            let url = rootUrl + "/" + pack.name + "/";
                            await AssetDB.create(url);
                            // 保存文件
                            let strData = JSON.stringify(manifest, null, 4);
                            await AssetDB.create(url + Config.PROJECT_FILE, strData);
                            await AssetDB.create(url + Config.VERSION_FILE, strData);
                        }
                    });

                    Editor.log("所有子包 manifest 文件保存在 " + rootUrl);
                },
                /**校验子包私有性 (是否互相引用) */
                async checkPrivate() {
                    let ok = await AssetsBundle.checkPrivate(this.subpackArr);
                    if (ok) {
                        Editor.success("检验成功");
                    } else {
                        Editor.error("检验失败");
                    }
                },
                /**保存插件配置信息 */
                saveConfig() {
                    let data = {
                        packageSaveDir: this.packageSaveDir,
                        isDebug: this.isDebug,
                        buildWithCheck: this.buildWithCheck,
                        mainPack: this.mainPack,
                        subpackArr: this.subpackArr,
                    }
                    Config.write(data);
                }

            }


        });
    },

    // register your ipc messages here
    messages: {
        async 'onBuildStart'(event, strData) {

            await this.vue.onBuildStart();

            if (event.reply) {
                // 返回子包配置信息
                event.reply(null);
            }
        },
        'onBuildFinished'(event, strData) {
            this.vue.onBuildFinished();
            plugConfig = {
                mainPack: this.vue.mainPack,
                subpackArr: this.vue.subpackArr,
                packageSaveDir: this.vue.packageSaveDir,
                isDebug: this.vue.isDebug,
                buildWithCheck: this.vue.buildWithCheck,
            }
            if (event.reply) {
                // 返回子包配置信息
                event.reply(null, JSON.stringify(plugConfig));
            }
        }
    },

    close() {
        Editor.log("assets-bundle: 插件已关闭");
        return true;
    }
});