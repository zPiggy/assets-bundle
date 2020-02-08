var path = require("path");
var Config = require("../Config");
var AssetsDB = require("./AssetsDB");

module.exports = {
    /**
     * 仅获取项目子包的自动图集信息
     * @returns {AutoAtlasInfo}
     */
    getSubPackageAutoAtlas(buildOptions) {
        let buildResults = buildOptions.buildResults;
        let autoAtlas = Object.create(null);

        let uuids = buildResults.getAssetUuids();
        for (let i = 0; i < uuids.length; i++) {
            let uuid = uuids[i];
            var url = Editor.assetdb.uuidToFspath(uuid);   // 获取不到资源路径的为 自动图集 (也可能是资源丢失)
            let subpackagesRoot = path.join(buildOptions.dest, Config.SUBPACKAGES, "/");
            let nativeUrl = buildResults.getNativeAssetPath(uuid);
            // 用 nativeUrl 排除资源丢失的情况
            if (!url && nativeUrl && nativeUrl.indexOf(subpackagesRoot) == 0) {
                let subPackName = this._getSubPackageName(nativeUrl, subpackagesRoot);
                // TODO: 当项目资源较大并且自动图集较多时 可能存在性能问题
                // FIXME: 此处可以采取 读取 ${Project}/temp/TexturePacker/build/raw-assets/ 目录下的自动图集信息
                var depends = this._getAutoAtlasUuids(uuid, buildResults);    // 精灵帧集合

                if (autoAtlas[subPackName] == undefined) {
                    autoAtlas[subPackName] = {
                        uuids: [],                              // 图集的uuid
                        containsSubAssets: Object.create(null)  // 图集包含的子图uuids
                    }
                }
                autoAtlas[subPackName].uuids.push(uuid);
                Object.assign(autoAtlas[subPackName].containsSubAssets, depends);
            }
        }

        // Editor.log("自动图集配置:", JSON.stringify(autoAtlas));

        return autoAtlas;
    },
    /**
     * 获取被自动图集打包的精灵帧和贴图Uuid集合
     * @param {string} uuid
     * @param {any} buildResults
     * @returns {{[uuid:string]: true}} uuid Map
     */
    _getAutoAtlasUuids(uuid, buildResults) {
        let _buildAssets = buildResults._buildAssets;
        let uuidsMap = Object.create(null);
        for (const _uuid in _buildAssets) {
            if (_buildAssets.hasOwnProperty(_uuid)) {
                let obj = _buildAssets[_uuid];
                if (typeof obj == "object" && Array.isArray(obj.dependUuids)) {
                    for (let i = 0; i < obj.dependUuids.length; i++) {
                        if (obj.dependUuids[i] == uuid) {
                            uuidsMap[_uuid] = true;
                            // 追加贴图uuid
                            let spUrl = AssetsDB.mainAssetdb.uuidToUrl(_uuid);
                            let textureUrl = path.dirname(spUrl);
                            let textureUuid = AssetsDB.mainAssetdb.urlToUuid(textureUrl);
                            if (textureUuid) {
                                uuidsMap[textureUuid] = true;
                            }
                        }
                    }
                }
            }
        }
        // return Object.keys(uuids);
        return uuidsMap;
    },

    _getSubPackageName(nativeUrl, root) {
        let name = "";
        name = nativeUrl.replace(root, "");
        name = name.split("/")[0]
        return name;
    },

}