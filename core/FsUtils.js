
var fs = require('fs');
var path = require('path');
var Electron = require('electron');

module.exports = {
    /**
     * 递归删除一个目录
     * @param {string} dir 
     */
    rmdirSync_R(dir) {
        var files = [];
        if (fs.existsSync(dir)) {
            files = fs.readdirSync(dir);
            files.forEach((file, index) => {
                var curPath = path.join(dir, file);
                if (fs.statSync(curPath).isDirectory()) { // recurse
                    this.rmdirSync_R(curPath);
                } else { // 删除文件
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(dir);  //删除目录
        }
    },


    /**
     * 打开(显示)一个目录
     * @param {string} dir 
     */
    openDir(dir) {
        dir = this.getAbsolutePath(dir);

        if (!fs.existsSync(dir)) {
            Editor.log("目录不存在：" + dir);
            return;
        }
        Electron.shell.showItemInFolder(dir);
        Electron.shell.beep();
    },
    /**
     * 选择一个目录
     * @param {string} title 
     * @param {string} defaultPath 
     */
    selectDir(title, defaultPath) {
        if (!title || typeof title != "string") {
            title = "选择一个文件夹";
        }
        if (!defaultPath) {
            defaultPath = Editor.Project.path; //默认打开项目目录
        }
        let res = Editor.Dialog.openFile({
            title: title,
            defaultPath: defaultPath,
            properties: ['openDirectory'],
        });
        if (res !== -1) {
            return res[0];
        }
        return "";

    },
    /**
     * 选择一个文件
     * @param {string} title 
     * @param {string} defaultPath 
     */
    selectFile(title, defaultPath) {
        if (!title || typeof title != "string") {
            title = "选择一个文件";
        }
        if (!defaultPath) {
            defaultPath = Editor.Project.path; //默认打开项目目录
        }
        let res = Editor.Dialog.openFile({
            title: title,
            defaultPath: defaultPath,
            properties: ['openFile'],
        });
        if (res !== -1) {
            Editor.log(res)
            return res[0];
        }
        return "";
    },
    /**
     * 获取相对路径
     */
    getRelativePath(url) {
        if (typeof url != "string") {
            return "";
        }
        if (this.isAbsolutePath(url)) {
            let root = path.join(Editor.Project.path, "/");
            let pathArr = url.split(root);
            if (pathArr.length === 2) {
                return pathArr[1];
            }
            return pathArr[0];
        }
        return url;
    },
    /**
     * 获取绝对路径
     */
    getAbsolutePath(url) {
        if (this.isAbsolutePath(url)) {
            return url;
        }
        return path.join(Editor.Project.path, url);
    },
    /**是否是绝对路径 */
    isAbsolutePath(url) {
        return url.indexOf(Editor.Project.path) === 0;
    },
}