'use strict';

import os from 'os';
import fs from 'fs';
import path from 'path';

import * as Utils from 'utils';
import * as Blam from 'blam';
import Logger from 'logger';
const logger = new Logger();


export default class BlamLocal
{
    /* customDir: BlamCustomDir */
    constructor(customDir) {
        this['addonList'] = {
            'default': [],
            'custom': []
        };
        this['osInfo'] = {};
        this['blVers'] = [];
        this['loginUser'] = "";
        this['pathSeparator'] = "/";

        if (customDir) { this['blamCustomDir'] = customDir; }
    }

    // get OS information
    _getOSInfo() {
        this['osInfo'] = {};
        this['pathSeparator'] = "/";
        logger.category('lib').info("Check Operating System Type ...");
        this['osInfo']['type'] = os.type().toString();
        this['osInfo']['release'] = os.release().toString();
        this['osInfo']['platform'] = os.platform().toString();
        logger.category('lib').info("===Operating System Infomation===");
        logger.category('lib').info(this['osInfo']);
        logger.category('lib').info("=================================");

        switch (this['osInfo']['type']) {
            case 'Windows_NT':
                this['pathSeparator'] = "\\";
            case 'Linux':
            case 'Darwin':
                this['pathSeparator'] = "/";
        }
    }

    // check blender version in user config directory
    _checkBlVer() {
        let fn = {};

        this['loginUser'] = "";
        this.blVers = [];

        fn['Windows_NT'] = (self_) => {
            let blUserPath;
            self_.loginUser = process.env['USERPROFILE'].split(path.sep)[2];
            blUserPath = "C:\\Users\\"
                + self_.loginUser
                + "\\AppData\\Roaming\\Blender Foundation\\Blender";
            if (!Utils.isDirectory(blUserPath)) { return; }
            self_.blVers = fs.readdirSync(blUserPath);
            self_.blVers = self_.blVers.filter( (dir) => {
                let isDir = Utils.isDirectory(blUserPath + '\\'+ dir);
                let isVersionDir = /[0-9]\.[0-9]{2}$/.test(dir);
                return isDir && isVersionDir;
            });
        };

        fn['Linux'] = (self_) => {
            let blUserPath;
            self_.loginUser = process.env['USER'];
            blUserPath = "/home/"
                + self_.loginUser
                + "/.config/blender";
            if (!Utils.isDirectory(blUserPath)) { return; }
            self_.blVers = fs.readdirSync(blUserPath);
            self_.blVers = self_.blVers.filter( (dir) => {
                let isDir = Utils.isDirectory(blUserPath + "/" + dir);
                let isVersionDir = /[0-9]\.[0-9]{2}$/.test(dir);
                return isDir && isVersionDir;
            });
        };

        fn['Darwin'] = (self_) => {
            let blUserPath;
            self_.loginUser = process.env['USER'];
            blUserPath = "/Users/"
                + self_.loginUser
                + "/Library/Application Support/Blender";
            if (!Utils.isDirectory(blUserPath)) { return; }
            self_.blVers = fs.readdirSync(blUserPath);
            self_.blVers = self_.blVers.filter( (dir) => {
                let isDir = Utils.isDirectory(blUserPath + "/" + dir);
                let isVersionDir = /[0-9]\.[0-9]{2}$/.test(dir);
                return isDir && isVersionDir;
            });
        };


        if (fn[this['osInfo']['type']]) {
            fn[this['osInfo']['type']](this);
        }
        else {
            throw new Error("Unknown operating system");
        }
    }

    // make add-on path from OS type, username, blender version
    _makeAddonPath(osType, user, blVer) {
        var scriptPath = this._makeScriptPath(osType, user, blVer);
        if (!scriptPath) {
            return null;
        }

        return scriptPath + this['pathSeparator'] + "addons";
    }

    // make script path from OS type, username, blender version
    _makeScriptPath(osType, user, blVer) {
        switch (osType) {
            case 'Windows_NT':
                return "C:\\Users\\" + user + "\\AppData\\Roaming\\Blender Foundation\\Blender\\" + blVer + "\\scripts";
            case 'Linux':
                return "/home/" + user + "/.config/blender/" + blVer + "/scripts";
            case 'Darwin':
                return "/Users/" + user + "/Library/Application Support/Blender/" + blVer + "/scripts";
        }

        return null;
    }

    // get installed add-on name
    _getInstalledAddonName() {
        let defaultAddonList = {};
        let customAddonList = {};

        for (let i = 0; i < this.blVers.length; ++i) {
            let version = this.blVers[i];
            defaultAddonList[version] = [];
            let scriptPath = this._makeAddonPath(this['osInfo']['type'], this['loginUser'], version);
            if (!scriptPath) { throw new Error("Failed to get script path"); }
            if (!Utils.isDirectory(scriptPath)) { continue; }
            let list = fs.readdirSync(scriptPath);
            list = list.filter( (e) => {
                return e != "__pycache__";
            });
            if (list.length == 0) { continue; }
            for (let l = 0; l < list.length; ++l) {
                defaultAddonList[version].push({'name': list[l]});
            }
        }


        // custom install directory
        if (this['blamCustomDir']) {
            let customDir = this['blamCustomDir'].getTarget();
            console.log(customDir);
            if (customDir && Utils.isDirectory(customDir)) {
                let list = fs.readdirSync(customDir);
                list = list.filter( (e) => {
                    return e != "__pycache__";
                });
                customAddonList[customDir] = [];
                for (let l = 0; l < list.length; ++l) {
                    customAddonList[customDir].push({'name': list[l]});
                }
            }
        }

        this['addonList']['default'] = defaultAddonList;
        this['addonList']['custom'] = customAddonList;
    }

    _buildBlInfo(addonPath, addonDir) {
        for (let i in addonDir) {
            let path = addonPath + this['pathSeparator'] + addonDir[i]['name'];
            let mainSrcPath = path;
            if (Utils.isDirectory(mainSrcPath)) {
                let list = fs.readdirSync(mainSrcPath);
                let found = false;
                for (let i = 0; i < list.length; ++i) {
                    if (list[i].indexOf("__init__.py") >= 0) {
                        mainSrcPath += this['pathSeparator'] + "__init__.py";
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    continue;   // skip if __init__.py is not found
                }
            }
            let srcBody = fs.readFileSync(mainSrcPath).toString();
            if (!Utils.isExistFile(mainSrcPath)) { throw new Error("File '" + mainSrcPath + "' does not exist"); }
            let blInfoBody = Blam.extractBlInfoBody(srcBody);
            if (!blInfoBody) { continue; }      // ignore
            let info = Blam.parseBlInfo(blInfoBody);
            if (!info) { continue; }            // ignore
            addonDir[i]['bl_info'] = Blam.validateBlInfo(info);
            addonDir[i]['main_src_path'] = mainSrcPath;
            addonDir[i]['src_path'] = path;

            // cleanup
            delete addonDir[i]['name'];
        }
        // cleanup
        addonDir = addonDir.filter( (elm) => {
            return elm['bl_info'] != undefined;
        });

        return addonDir;
    }

    // get bl_info
    _getBlInfo() {
        let defaultDirList = this['addonList']['default'];
        let customDirList = this['addonList']['custom'];

        for (let key in defaultDirList) {
            let addonPath = this._makeAddonPath(this['osInfo']['type'], this['loginUser'], key);
            if (!addonPath) { throw new Error("Failed to get add-on path"); }
            defaultDirList[key] = this._buildBlInfo(addonPath, defaultDirList[key]);
        }

        for (let key in customDirList) {
            customDirList[key] = this._buildBlInfo(key, customDirList[key]);
        }


        this['addonList']['default'] = defaultDirList;
        this['addonList']['custom'] = customDirList;
    }

    // get blender version which is installed on machine
    getInstalledBlVers() {
        this._getOSInfo();
        this._checkBlVer();

        return this.blVers;
    }

    // check installed blender add-on
    checkInstalledBlAddon() {
        this._getOSInfo();
        this._checkBlVer();
        this._getInstalledAddonName();
        this._getBlInfo();
    }

    getAddonPath(blVer) {
        this._getOSInfo();
        this._checkBlVer();

        let scriptPath = this._makeAddonPath(this['osInfo']['type'], this['loginUser'], blVer);
        if (!scriptPath) { return null; }
        if (!Utils.isDirectory(scriptPath)) { return null; }

        return scriptPath;
    }

    createAddonDir(blVer) {
        this._getOSInfo();
        this._checkBlVer();

        let scriptPath = this._makeScriptPath(this['osInfo']['type'], this['loginUser'], blVer);
        let addonPath = this._makeAddonPath(this['osInfo']['type'], this['loginUser'], blVer);
        if (!scriptPath) { throw new Error("Failed to create " + scriptPath); }
        if (!Utils.isDirectory(scriptPath)) {
            if (Utils.isExistFile(scriptPath)) { throw new Error(scriptPath + " is already exist"); }
            fs.mkdirSync(scriptPath);
        }
        if (!Utils.isDirectory(addonPath)) {
            if (Utils.isExistFile(addonPath)) { throw new Error(addonPath + " is already exist"); }
            fs.mkdirSync(addonPath);
        }
    }

    getPathSeparator() {
        return this['pathSeparator'];
    }

    loadFrom(file) {
        if (!Utils.isExistFile(file)) { return 1; }

        let data =fs.readFileSync(file, 'utf8');
        let json = JSON.parse(data);

        this['addonList'] = json['addonList'] || [];
    }

    saveTo(file) {
        fs.writeFileSync(file, JSON.stringify(this['addonList'], null, '  '));
    }
}
