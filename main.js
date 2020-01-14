'use strict';

var IPC = require('./core/IPC');
var AssetsBundle = require("./core/AssetsBoundle");


module.exports = {
    load() {
        // Editor.log("加载成功, 项目编译时请始终保持此插件同时打开");
        Editor.Builder.on('build-finished', this.onBuildFinished);
        Editor.Builder.on('build-start', this.onBuildStart);
    },

    unload() {
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

        Editor.success(":::::: 开始打包资源 ::::::");
        try {
            var buildResults = options.buildResults;
            // Editor.log("编译完成:", options);
            let buildDest = options.dest;
            let platform = options.platform; // 'android',
            let _subpackages = buildResults._subpackages;
            let [error, strData] = await IPC.sendToPanel("onBuildFinished");
            if (!error) {
                /**@type {PlugConfig} */
                let plugConfig = JSON.parse(strData);
                AssetsBundle.init(plugConfig, buildDest, _subpackages);

                Editor.log("开始校验资源安全性和私有性");
                console.log("开始校验资源安全性和私有性");
                if (await AssetsBundle.check()) {
                    Editor.log("开始打包");
                    await AssetsBundle.run();
                }
            }
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