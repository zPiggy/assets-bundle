
var fs = require("fs");
var FsExtra = require("fs-extra");
var path = require("path");
var assetdb = Editor.assetdb;

var uuidRegExpStr = "[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}";
var isUuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

var scriptType = ["javascript", "typescript", "coffeescript"];

module.exports = {
    get mainAssetdb() {
        if (Editor.isMainProcess) {
            return Editor.assetdb;
        }
        return Editor.remote.assetdb;
    },
    _isUuid(uuid) {
        return isUuid.test(uuid);
    },
    _isUrl(url = "") {
        return url.indexOf("db://") == 0;
    },
    /**
     * 相对路径转 url (仅做转换未校验url是否存在)
     * @param {string}} rPath 
     * @returns {string}
     */
    getUrlByRelativepath(rPath) {
        if (this._isUrl(rPath)) return rPath;
        // 去除前后的 "/"
        rPath.replace(/\/$/, "");
        rPath.replace(/^\//, "");
        return "db://" + rPath;
    },
    /**
     * 获取一个存在的url
     * @param {string} rPath 
     * @returns {string | ""}
     */
    getExistUrlByRelativepath(rPath) {
        let url = this.getUrlByRelativepath(rPath);
        if (this.mainAssetdb.exists(url)) {
            return url;
        }
        return "";
    },

    async _handle(param, assetdbHandle) {
        return new Promise((resolve) => {
            assetdbHandle(param, (err, data) => {
                if (err) {
                    Editor.error(err);
                    resolve(undefined);
                } else {
                    resolve(data);
                }
            })
        });
    },
    /**
     * 
     * @param {string} rPath 
     * @param {*} assetdbHandle 
     */
    async _rPathHandle(rPath, assetdbHandle) {
        let url = this.getUrlByRelativepath(rPath);
        // console.log(url);
        return this._handle(url, assetdbHandle);
    },
    async _uuidHandle(rPath, assetdbHandle) {
        let uuid = await this.getUuidByUrl(rPath);
        return this._handle(uuid, assetdbHandle);
    },
    /////////////////////

    async getPathByUrl(rPath) {
        return this._rPathHandle(rPath, assetdb.queryPathByUrl);
    },

    async getUuidByUrl(rPath) {
        return this._rPathHandle(rPath, assetdb.queryUuidByUrl);
    },
    /**
     * 
     * @param {string} rPath 相对路径或者 url 路径
     * @returns {Promise<{
     * isSubAsset: false
     * path: "/Users/admin/GameX/assets/Game"
     * type: AssetType
     * url: "db://assets/Game"
     * uuid: "7077b727-cffc-4094-9d01-dbdc6bb779dc"
     * }>}
     */
    async getInfoByUrl(rPath) {
        return this._uuidHandle(rPath, assetdb.queryInfoByUuid);
    },
    /**
     * 
     * @param {string} rPath 相对路径或者 url 路径
     * @returns {Promise<{
     * assetMtime: number
     * assetPath: "资源的绝对路径"
     * assetType: "string"
     * assetUrl: "db://assets/xxx"
     * defaultType: "folder"
     * isSubMeta: boolean
     * json: "meta文件json内容"
     * metaMtime: number
     * metaPath: "meta文件绝对路径"
     * }>} 
     */
    async getMetaInfoByUrl(rPath) {
        return this._uuidHandle(rPath, assetdb.queryMetaInfoByUuid);
    },


    // 
    /**
     * 资源查询
     * @param pattern url的匹配模式
     * @param { AssetType | AssetType[] } type
     * @returns {Promise<Asset[]>}
     */
    async getAssets(pattern, type = "", extType = undefined) {
        return new Promise((resolve) => {
            assetdb.queryAssets(pattern, type, (err, results) => {
                if (err) {
                    resolve([]);
                } else {
                    if (extType && extType.length) {
                        let filter = results.filter((asset, index) => {
                            return extType.indexOf(asset.type) === -1;
                        })
                        resolve(filter);
                    }
                    else {
                        resolve(results)
                    }
                }
            })
        })
    },

    async getAssetsFolders() {
        return await this.getAssets("db://assets/**/*", "folder");
    },

    async create(url, strData) {
        return new Promise((resolve) => {
            Editor.assetdb.create(url, strData, function (err, results) {
                if (err) {
                    Editor.error(error);
                    resolve([]);
                } else {
                    resolve(results);
                }
            });
        });
    },
    /**
     * 
     * @param {string[]} urls 
     */
    async delete(urls) {
        return new Promise((resolve) => {
            Editor.assetdb.delete(urls, (err, results) => {
                if (err) {
                    Editor.error(error);
                    resolve([])
                }
                else { resolve([]) }
            })
        })
    },

    async createOrSave(url, strData) {
        if (this.mainAssetdb.exists(url)) {
            return new Promise((resolve) => {
                this.mainAssetdb.saveExists(url, strData, (err, meta) => {
                    if (error) {
                        Editor.error(error);
                        resolve(undefined);
                    }
                    else {
                        resolve(meta);
                    }
                });
            });
        }
        else {
            await this.create(url, strData);
        }
    },

    async refresh(url) {
        return new Promise((resolve) => {
            Editor.assetdb.refresh(url, (err, results) => {
                if (err) {
                    Editor.error(error);
                    resolve([]);
                }
                else {
                    resolve(results);
                }
            })
        });
    },

    /**
     * mkdir -p
     * @param {string} url 
     */
    async mkdirp(url) {
        let fspath = Editor.url(url);
        if (!fspath) {
            Editor.error("创建目录失败: " + url);
            return;
        }
        let newdir = FsExtra.mkdirpSync(fspath);
        // 刷新资源
        if (newdir) {
            let newUrl = this.mainAssetdb.fspathToUrl(newdir);
            if (newUrl) {
                return new Promise((resolve) => {
                    this.mainAssetdb.refresh(newUrl, (err) => {
                        if (err) {
                            Editor.error(error);
                        }
                        resolve();
                    });
                })
            }
        }
    },


    /**
     * 获取当前目录所有uuid包括依赖的uuid(包括自己)
     * @param {"db://assets/xxx"} url 
     * @param {AssetType} type
     * @returns {Promise<{[uuid:string]: boolean}>}
     */
    async getDependsRecursively(pattern, type = "", findedMap = null, extType = []) {
        findedMap = findedMap || Object.create(null);
        // 获取直系uuid
        let uuidMap = await this.getDepends(pattern, type, null, extType);
        // 开始递归获取依赖的uuids
        if (Object.keys(uuidMap).length) {
            for (var uuid in uuidMap) {
                if (!findedMap[uuid]) {
                    let url = this.mainAssetdb.uuidToUrl(uuid);
                    delete uuidMap[uuid];
                    if (!url) {
                        Editor.error(pattern + " 丢失资源:: " + uuid);
                        continue;
                    }
                    if (url.indexOf("db://internal/") == 0) {   // 过滤引擎内置资源
                        continue;
                    }
                    findedMap[uuid] = true;
                    await this.getDepends(url, "", uuidMap, extType);    // 不断注重新的 uuid 到 uuidMap
                }
            }
        }
        return findedMap;
    },
    /**
     * 获取依赖关系uuids
     * @param pattern url的匹配模式
     * @param { AssetType | AssetType[] } type
     * @returns {Promise<{[uuid:string]: boolean}>}
     */
    async getDepends(pattern, type = "", uuidMap, extType = []) {
        uuidMap = uuidMap || Object.create(null);
        let assets = await this.getAssets(pattern, type);
        for (let i = 0; i < assets.length; i++) {
            var asset = assets[i];
            if (asset.type == "folder") {   // 无视目录
                continue;
            }
            else if (asset.destPath) {
                this.getFileUuids(asset.destPath, uuidMap);
                if (!extType || extType.indexOf(asset.type) == -1) {    // 过滤指定类型
                    uuidMap[asset.uuid] = true;   // 加入自己
                }
            }
        }

        return uuidMap;
    },
    /**
     * 获取文件内的 uuid 
     * @param {string} Fspath 绝对路径 
     * @returns {{[uuid:string]: boolean}}
     */
    getFileUuids(fspath, uuidMap) {
        let uuidRegExp = new RegExp().compile(uuidRegExpStr, "gi");

        uuidMap = uuidMap || Object.create(null);
        if (fs.existsSync(fspath)) {
            let json = fs.readFileSync(fspath, "utf8");
            let uuids = json.match(uuidRegExp);
            if (uuids) {
                for (let i = 0; i < uuids.length; i++) {
                    uuidMap[uuids[i]] = true;// 去重
                }
            }
        }
        return uuidMap;
    },


}