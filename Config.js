let fs = require('fs');
let path = require('path');
var FsExtra = require("fs-extra");


var CONF_PATH = "settings";
var CONF_FILE_NAME = "AssetsBundle.json";


class Config {
    /** @type {"db://assets/resources/Manifest"} */
    MANIFEST_DIR_URL = "db://assets/resources/Manifest";
    /**@type {"project.manifest"} */
    PROJECT_FILE = "project.manifest";
    /**@type {"version.manifest"} */
    VERSION_FILE = "version.manifest";
    /**@type {"Debug"} */
    DEBUG_DIR = "Debug";
    /**@type {"subpackages"} */
    SUBPACKAGES = "subpackages";
    ScriptType = ["javascript", "typescript", "coffeescript"];
    IMPORT_DIR = "import";


    configFile = "";

    constructor() {
        this.configFile = path.join(Editor.Project.path, CONF_PATH, CONF_FILE_NAME);
    }

    /**
     * 读取配置文件
     * @returns {PlugConfig}
     */
    read() {
        let file = this.configFile;
        if (fs.existsSync(file) === false) {
            return undefined;
        }

        let json = fs.readFileSync(file, "utf8");
        let config = JSON.parse(json);
        return config;
    }
    /**
     * 
     * @param {PlugConfig} config
     */
    write(config) {
        let file = this.configFile;
        let dir = path.dirname(file);
        if (fs.existsSync(dir)) {
            FsExtra.mkdirpSync(dir);
        }

        // 写入文件
        fs.writeFileSync(file, JSON.stringify(config, null, 4));
        Editor.log("配置文件保存成功 " + file);
    }


    /**
     * 删除配置文件
     */
    delConfig() {
        let file = this.configFile;
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    }


}

module.exports = new Config();