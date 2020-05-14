//
// CocosCreator 热更打包模块
//
var fs = require("fs");
var FsExtra = require("fs-extra");
var crypto = require("crypto");
var path = require("path");
var Config = require("../Config");
var AssetsDB = require("./AssetsDB");
var FsUtils = require("./FsUtils");
var JSZIP = require('jszip');

var ZIP_COMMON_DATE = new Date("2020-01-01");  // zip压缩时采用的公共文件修改时间

module.exports = {

    /**
     * 编译子包清单
     * @param {string} targetDir 
     * @param {Package} packInfo 
     * @param {boolean} isDebug 
     */
    async build(targetDir, packInfo, isDebug) {
        if (packInfo.zipImport) {
            Editor.log("开始zip压缩import目录");
            let fsDir = path.join(targetDir, "res/import");
            await this.zipDir(fsDir);
            Editor.log("完成压缩");
        }
        if (packInfo.zipRawassets) {
            Editor.log("开始zip压缩raw-assets目录");
            let fsDir = path.join(targetDir, "res/raw-assets");
            if (fs.existsSync(fsDir) == false) {
                // 如果外层目录不存在 则可能是子包 raw-assets 目录在 subpackages 目录内
                fsDir = path.join(targetDir, Config.SUBPACKAGES, packInfo.name, "raw-assets");
            }
            await this.zipDir(fsDir);
            Editor.log("完成压缩");
        }

        let manifest = this.generateManifest(packInfo, isDebug);
        this.buildManifest(targetDir, manifest);
        // 3.写入 Manifest 文件到热更目录
        this.writeManifest(targetDir, manifest);

        // 4.除本地分包以外的所有分包都需要写入一份清单文件到项目中
        if (packInfo.type != "LOCAL") {
            let manifestDirUrl = Config.MANIFEST_DIR_URL + "/" + packInfo.name + "/";
            if (AssetsDB.mainAssetdb.exists(manifestDirUrl) == false) {
                await AssetsDB.mkdirp(manifestDirUrl);
            }

            // 如果是远程包 需要写入空清单文件
            if (packInfo.type === "REMOTE") {
                manifest = this.generateEmptyManifest(packInfo, isDebug);
            }

            let destDir = AssetsDB.mainAssetdb.urlToFspath(manifestDirUrl);
            this.writeManifest(destDir, manifest);
            // 刷新资源
            await AssetsDB.refresh(manifestDirUrl);
        }

    },

    /**
     * 为目录生成热更对象(仅支持 构建目录【${project}/build/jsb-default 或者 ${project}/HotUpdate/xxxx】)
     * @param {string} srcDir 目录
     * @param {Manifest} outObj 热更对象
     * @returns Mainfest 对象
     */
    buildManifest(srcDir, manifest) {
        manifest = manifest || Object.create(null);
        manifest.assets = manifest.assets || Object.create(null);

        let srcPath = path.join(srcDir, "src");
        let resPath = path.join(srcDir, "res");
        let subPath = path.join(srcDir, "subpackages");

        this._readDir(srcDir, srcPath, manifest.assets);
        this._readDir(srcDir, resPath, manifest.assets);
        this._readDir(srcDir, subPath, manifest.assets);

        return manifest;
    },

    /**
     * 
     * @param {string} dir 
     * @param {ManifestAssets} assets
     * @returns {string[]} 所有文件的完整路径
     * @private
     */
    _readDir(root, dir, assets) {
        if (fs.existsSync(dir) == false) return;
        let stat = fs.statSync(dir);
        if (stat.isDirectory() == false) return;

        let subpaths = fs.readdirSync(dir), subpath, size, md5, compressed, relative;

        for (let i = 0; i < subpaths.length; ++i) {
            if (subpaths[i][0] === '.') continue;
            // 完整路径
            subpath = path.join(dir, subpaths[i]);
            stat = fs.statSync(subpath);
            if (stat.isDirectory()) {
                // 递归读取子目录
                this._readDir(root, subpath, assets);
            }
            else if (stat.isFile()) {
                // Size in Bytes
                size = stat['size'];
                md5 = crypto.createHash('md5').update(fs.readFileSync(subpath, 'binary')).digest('hex');
                compressed = path.extname(subpath).toLowerCase() === '.zip';
                // 获取相对路径
                relative = path.relative(root, subpath);
                relative = relative.replace(/\\/g, '/');
                relative = encodeURI(relative);

                assets[relative] = {
                    'size': size,
                    'md5': md5
                };
                if (compressed) {
                    assets[relative].compressed = true;
                }
            }
        }
    },

    /**
     * 生成 Manifest 对象
     * @param {Package} packInfo
     * @param {boolean} isDebug 是否调试
     * @param {Manifest} manifest 可能已经存在的 Manifest 对象
     * @returns {Manifest} Manifest 对象
     */
    generateManifest(packInfo, isDebug = false, manifest) {
        manifest = manifest || Object.create(null);
        //
        // "http://host" 会被 path.join 转成  "http:/host"
        //
        let packageUrl = packInfo.packageUrl.trim();
        packageUrl = packageUrl.replace(/\/$/, "");     // 去除尾部的 '/'
        if (isDebug) {
            packageUrl += "/" + Config.DEBUG_DIR;
        }
        packageUrl += "/" + packInfo.name;
        let remoteVersionUrl = packageUrl + "/" + Config.VERSION_FILE;
        let remoteManifestUrl = packageUrl + "/" + Config.PROJECT_FILE;

        manifest.version = packInfo.version;
        manifest.name = packInfo.name;
        manifest.zhName = packInfo.zhName;
        manifest.packageUrl = packageUrl;
        manifest.remoteVersionUrl = remoteVersionUrl;
        manifest.remoteManifestUrl = remoteManifestUrl;
        // manifest.searchPaths = [];
        manifest.assets = manifest.assets || Object.create(null);
        return manifest;
    },
    /**
     * 生成基础的 Manifest 对象(version="0.0.1")
     * @param {Package} packInfo
     * @param {boolean} isDebug 是否调试
     * @returns {Manifest} Manifest 对象
     */
    generateEmptyManifest(packInfo, isDebug = false) {
        let newPack = JSON.parse(JSON.stringify(packInfo));
        newPack.version = "0.0.1";
        let manifest = this.generateManifest(newPack, isDebug);
        delete manifest.assets;
        delete manifest.searchPaths;
        return manifest;
    },
    /**
     * 写入清单文件
     * @param {string} destDir 
     * @param {Manifest} manifest 
     */
    writeManifest(destDir, manifest) {
        // 写入 project.manifest
        let file = path.join(destDir, Config.PROJECT_FILE);
        FsExtra.writeJSONSync(file, manifest);
        // Editor.log(file);
        // 写入 version.manifest
        let version = JSON.parse(JSON.stringify(manifest));
        delete version.assets;
        delete version.searchPaths;
        file = path.join(destDir, Config.VERSION_FILE);
        FsExtra.writeJSONSync(file, version);
        // Editor.log(file);

    },




    async zipDir(fsDir) {
        let dirName = path.basename(fsDir);
        let dir = path.dirname(fsDir);
        if (fs.existsSync(fsDir) == false) {
            Editor.error("zip错误,文件或目录不存在: " + fsDir);
            return;
        }
        let zip = new JSZIP();
        // 1.创建一级目录
        zip.file(dirName, null, { dir: true, date: ZIP_COMMON_DATE });
        // 2.开始zip压缩目录
        this.ziped_dir(fsDir, zip.folder(dirName));

        let saveFile = path.join(dir, dirName + ".zip");
        fs.existsSync(saveFile) && (fs.unlinkSync(saveFile));
        let p = new Promise((resolve) => {
            zip.generateNodeStream({
                type: "nodebuffer",
                streamFiles: true
            }).pipe(fs.createWriteStream(saveFile)).on("finish",
                function () {
                    resolve(null);
                }.bind(this)).on("error",
                    function (e) {
                        resolve(e);
                    }.bind(this));
        });

        let err = await p;
        if (err) {
            Editor.error("zip失败: " + fsDir, saveFile);
            return;
        }
        if (fs.existsSync(saveFile) == false) {
            Editor.error("zip失败,文件不存在: " + fsDir, saveFile);
            return;
        }

        // 压缩成功后 移除目录
        FsUtils.rmdirSync(fsDir);
    },
    /**
     * 
     * @param {string} dir 
     * @param {JSZip} zipInstance
     */
    ziped_dir(dir, zipInstance) {
        let files = fs.readdirSync(dir);
        for (let i = 0; i < files.length; i++) {
            let fileName = files[i];
            if (fileName[0] == "." || fileName == "..") {
                continue;
            }
            let fullPath = path.join(dir, fileName);
            let stat = fs.statSync(fullPath);
            if (stat.isFile()) {
                /**
                 * zip文件的MD5会计算每一个文件的最后修改时间 由于子包中的每一个文件都是在每次构建时重新生成这将导致MD5始终不一致
                 * 所以此处忽略文件的修改时间(写死一个固定的时间)
                 */
                zipInstance.file(fileName, fs.readFileSync(fullPath), { date: ZIP_COMMON_DATE });
            } else if (stat.isDirectory()) {
                zipInstance.file(fileName, null, { dir: true, date: ZIP_COMMON_DATE });
                this.ziped_dir(fullPath, zipInstance.folder(fileName));
            }
        }
    },

}