'use strict';
var path = require("path");
var fs = require("fs");

var IPC = require('./core/IPC');
var AssetsBundle = require("./core/AssetsBundle");
var AutoAtlasUtils = require("./core/AutoAtlasUtils");
// 重新编译 main.js 追加设置搜索路径逻辑
function reBuildMainJs(buildOptions) {
    let buildDestPath = buildOptions.dest;
    var root = path.normalize(buildDestPath);
    var url = path.join(root, "main.js");
    let data = fs.readFileSync(url, "utf8");
    if (data && typeof data === "string") {
        var newStr =
            "\n" +
            "if (window.jsb) { \n" +
            "    var hotUpdateSearchPaths = localStorage.getItem('HotUpdateSearchPaths'); \n" +
            "    if (hotUpdateSearchPaths) { \n" +
            "        jsb.fileUtils.setSearchPaths(JSON.parse(hotUpdateSearchPaths)); \n" +
            "    }\n" +
            "}\n";
        var newData = newStr + data;
        fs.writeFileSync(url, newData, "utf8");

        Editor.log("[assets-bundle]:: 'HotUpdateSearchPaths' 已插入 main.js 文件头部");
    }
}


module.exports = {
    load() {

        Editor.Builder.on('build-finished', this.onBuildFinished);
        Editor.Builder.on('build-start', this.onBuildStart);
    },

    unload() {
        Editor.warn("assets-bundle: 插件已卸载");
        Editor.Builder.removeListener('build-finished', this.onBuildFinished);
        Editor.Builder.removeListener('build-start', this.onBuildStart);
    },


    /**编译开始 */
    async onBuildStart(options, callback) {
        if (!Editor.Panel.findWindow("assets-bundle")) {
            callback();
            return;
        }
        // 动态设置子包 并获取子包配置信息
        try {
            let [error] = await IPC.sendToPanel("onBuildStart");
            error && Editor.error(error);
        } catch (error) {
            Editor.error(error);
        }

        callback();
    },

    async onBuildFinished(options, callback) {
        if (!Editor.Panel.findWindow("assets-bundle")) {
            callback();
            return;
        }
        var buildResults = options.buildResults;

        Editor.success(":::::: 开始打包资源 ::::::");
        try {
            let autoAtlasInfo;
            if ("如果自动图集分离存在问题,直接注释if即可") {
                autoAtlasInfo = AutoAtlasUtils.getSubPackageAutoAtlas(options);
                // Editor.log("自动图集信息:", autoAtlasInfo);
            }

            // Editor.log("编译完成:", options);
            let buildDest = options.dest;
            let platform = options.platform; // 'android',
            let _subpackages = buildResults._subpackages;
            let [error, strData] = await IPC.sendToPanel("onBuildFinished");
            if (!error) {
                /**@type {PlugConfig} */
                let plugConfig = JSON.parse(strData);
                let buildWithCheck = plugConfig.buildWithCheck;

                AssetsBundle.init(plugConfig, buildDest, _subpackages);
                let isOK = true;
                if (buildWithCheck) {
                    Editor.log("开始校验资源安全性和私有性");
                    isOK = await AssetsBundle.check();
                }
                else {
                    Editor.log("已跳过资源校验, 请自行确保资源安全和私有性");
                }

                if (isOK) {
                    Editor.log("开始打包");
                    await AssetsBundle.run(autoAtlasInfo);
                }
                else {
                    Editor.error("资源打包失败!");
                }
            }

            reBuildMainJs(options);

        } catch (error) {
            Editor.error(error);
        }

        Editor.success(":::::: 打包资源结束 ::::::");
        callback();
    },

    // register your ipc messages here
    messages: {
        'open'() {
            // open entry panel registered in package.json
            Editor.Panel.open('assets-bundle');
        }
    },
};