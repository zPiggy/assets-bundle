var Ipc = Editor.Ipc
var packageJson = require("../package.json");
var packName = packageJson.name;

module.exports = {
    /**
     * 发送消息到面板
     * @param {string} funcName 
     * @param {string} strData 
     * @returns {Promise<[Error,string]>}
     */
    async _toPanel(funcName, strData) {
        return new Promise((resolve) => {
            Ipc.sendToPanel(packName, funcName, strData, (error, data) => {
                if (error) {
                    Editor.error("sendToPanel::", packName, funcName);
                    Editor.error(error);
                }
                resolve([error, data]);
            })
        });
    },
    /**
    * 发送消息到主进程
    * @param {string} funcName
    * @param {string} strData
    * @returns {Promise<[Error,string]>}
    */
    async _toMain(funcName, strData) {
        return new Promise((resolve) => {
            Ipc.sendToMain(packName + ":" + funcName, strData, (error, data) => {
                if (error) {
                    Editor.error("sendToMain::", packName, packName + ":" + funcName);
                    Editor.error(error);
                }
                resolve([error, data]);
            })
        });
    },

    async sendToPanel(funcName, strData) {
        return this._toPanel(funcName, strData);
    },

    async sendToMain(funcName, strData) {
        return this._toMain(funcName, strData);
    },



}