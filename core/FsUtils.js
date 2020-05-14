
var fs = require('fs');
var path = require('path');
var Electron = require('electron');

module.exports = {
    _rmdirSync(dir, removeSelf) {
        let files = fs.readdirSync(dir);
        files.forEach((file, index) => {
            var curPath = path.join(dir, file);
            if (fs.statSync(curPath).isDirectory()) { // recurse
                this._rmdirSync(curPath, true);
            } else { // 删除文件
                fs.unlinkSync(curPath);
            }
        });

        if (removeSelf === true) {
            fs.rmdirSync(dir);  //删除目录
        }
    },

    /**
     * 删除一个目录
     * @param {string} dir 
     */
    rmdirSync(dir) {
        if (fs.existsSync(dir)) {
            this._rmdirSync(dir, true);
        }
    },

    /**
     * 清空一个目录
     * @param {string} dir
     */
    clearDirSync(dir) {
        if (fs.existsSync(dir)) {
            if (fs.existsSync(dir)) {
                this._rmdirSync(dir);
            }
        }
    },

    mkdirpSync(dir) {
        let _mkdirpSync = function (_dir) {
            let parentDir = path.dirname(_dir);
            // 不存在 或 存在的为同名非目录
            if (fs.existsSync(parentDir) == false || fs.statSync(parentDir).isDirectory() == false) {
                _mkdirpSync(parentDir);
            }

            fs.mkdirSync(_dir);
        }

        // 校验目录完整性
        let info = path.parse(dir);
        if (!info.root) {
            throw new Error("路径不完整: " + dir);
        }

        // 判断当前目录是否存在
        if (fs.existsSync(dir) == true && fs.statSync(dir).isDirectory() == true) {
            return;
        }

        _mkdirpSync(dir);
    },

    moveFileSync(srcFile, destFile, overWrite) {
        if (overWrite === true && fs.existsSync(destFile) && fs.statSync(destFile).isFile()) {
            fs.unlinkSync(destFile);
        }
        this._copyFileSync(srcFile, destFile, true);
    },

    copyFileSync(srcFile, destFile, overWrite) {
        if (overWrite === true && fs.existsSync(destFile) && fs.statSync(destFile).isFile()) {
            fs.unlinkSync(destFile);
        }
        this._copyFileSync(srcFile, destFile, false);
    },


    moveDirSync(srcDir, destDir) {
        let stat = fs.statSync(srcDir);
        if (stat.isDirectory() == false) {
            throw new Error("不是一个目录: " + srcDir);
        }

        this._copyDirSync(srcDir, destDir, true);
    },

    copyDirSync(srcDir, destDir) {
        let stat = fs.statSync(srcDir);
        if (stat.isDirectory() == false) {
            throw new Error("不是一个目录: " + srcDir);
        }

        this._copyDirSync(srcDir, destDir, false);
    },


    _copyDirSync(srcDir, destDir, isMove) {
        let names = fs.readdirSync(srcDir);
        // 保证目标文件夹干净
        if (fs.existsSync(destDir) && fs.statSync(destDir).isDirectory()) {
            this.clearDirSync(destDir);
        }
        else {
            this.mkdirpSync(destDir);
        }

        names.forEach(name => {
            let srcFile = path.join(srcDir, name);
            let destFile = path.join(destDir, name);

            let stat = fs.statSync(srcFile);
            if (stat.isFile()) {
                if (isMove === true) {
                    this.moveFileSync(srcFile, destFile);
                }
                else {
                    this.copyFileSync(srcFile, destFile);
                }
            }
            else if (stat.isDirectory()) {
                this._copyDirSync(srcFile, destFile, isMove);
            }
        })

        if (isMove === true) {
            this.rmdirSync(srcDir);
        }

    },

    _copyFileSync(srcFile, destFile, isMove) {
        // 先创建目录
        let parentDir = path.dirname(destFile);
        this.mkdirpSync(parentDir);

        if (isMove) {
            fs.renameSync(srcFile, destFile);
        }
        else {
            fs.copyFileSync(srcFile, destFile)
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