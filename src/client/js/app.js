'use strict';

import fs from 'fs';
import fsext from 'fs-extra';
import del from 'del';
import electron from 'electron';
import * as Utils from 'utils';

import BlamOS from 'blam-os';
const blamOS = new BlamOS();
import BlamDB from 'blam-db';
const blamDB = new BlamDB();
import BlamCustomDir from 'blam-custom-dir';
const blamCustomDir = new BlamCustomDir();
import BlamLocal from 'blam-local';
const blamLocal = new BlamLocal(blamCustomDir, blamOS);
import BlamIgnore from 'blam-ignore';
const blamIgnore = new BlamIgnore();
import TaskMgr from 'task';
const taskMgr = new TaskMgr();
import Logger from 'logger';
const logger = new Logger();
import * as Blam from 'blam';

import {
        DB_DIR, API_VERSION_FILE, GITHUB_ADDONS_DB, INSTALLED_ADDONS_DB, IGNORE_ADDONS_DB,
        CUSTOM_DIR_DB, CONFIG_DIR, CONFIG_FILE_PATH, BL_INFO_UNDEF, CONFIG_FILE_INIT
} from 'blam-constants';


var config = null;
var app = angular.module('blAddonMgr', [])


app.controller('MainController', function ($scope, $timeout) {

    var main = this;
    main.repoList = [];

    $scope.blVerList = blamOS.getBlenderVersions();
    $scope.blVerList.push('Custom');
    $scope.blVerSelect = $scope.blVerList[0];
    $scope.showBlVerSelect = true;

    $scope.addonOrderItemList = [
        {name: 'Sort:', value: ''},
        {name: 'Add-on Name', value: 'ADDON_NAME'},
        {name: 'Author', value: 'AUTHOR'}
    ];
    $scope.addonOrderItemSelect = $scope.addonOrderItemList[0];

    $scope.onAddonSelectorChanged = onAddonSelectorChanged;

    //$scope.blVerList.push('Custom');
    $scope.addonCategories = [
        {id: 1, name: 'All', value: 'All'},
        {id: 2, name: '3D View', value: '3D View'},
        {id: 3, name: 'Add Curve', value: 'Add Curve'},
        {id: 4, name: 'Add Mesh', value: 'Add Mesh'},
        {id: 5, name: 'Animation', value: 'Animation'},
        {id: 6, name: 'Development', value: 'Development'},
        {id: 7, name: 'Game Engine', value: 'Game Engine'},
        {id: 8, name: 'Import-Export', value: 'Import-Export'},
        {id: 9, name: 'Material', value: 'Material'},
        {id: 10, name: 'Mesh', value: 'Mesh'},
        {id: 11, name: 'Node', value: 'Node'},
        {id: 12, name: 'Object', value: 'Object'},
        {id: 13, name: 'Paint', value: 'Paint'},
        {id: 14, name: 'Pie Menu', value: 'Pie Menu'},
        {id: 15, name: 'Render', value: 'Render'},
        {id: 16, name: 'Rigging', value: 'Rigging'},
        {id: 17, name: 'System', value: 'System'},
        {id: 18, name: 'UI', value: 'UI'},
        {id: 19, name: 'UV', value: 'UV'}
    ];
    $scope.addonLists = [
        {id: 1, name: 'Installed', value: 'installed'},
        {id: 2, name: 'GitHub', value: 'github'},
        {id: 3, name: 'Update', value: 'update'}
    ];
    $scope.customDirItemList = [];
    $scope.addonListActive = 1;
    $scope.addonOrder = 'ASCEND';

    // "Update GitHub DB" button
    $scope.onGitHubDBBtnClicked = function ($event) {
        updateGitHubAddonDB($scope);
    };

    // "Update Install DB" button
    $scope.onInstDBBtnClicked = function ($event) {
        updateInstalledAddonDB($scope);
        onAddonSelectorChanged();
    };

    // "Manage Ignore DB button"
    $scope.onIgnDBBtnClicked = function ($event) {
        showIgnoreListPopup($scope);
    };

    // "Add Custom Directory button"
    $scope.onCustomDirBtnClicked = function ($event) {
        showCustomdirListPopup($scope);
    };

    function updateIgnoreList($scope) {
        $scope.ignoreList = blamIgnore.getList();
        $scope.ignoreCandItemList = [];
        let keys = Object.keys($scope.addonStatus);
        for (let i = 0; i < keys.length; ++i) {
            let k = keys[i];
            if ($scope.addonStatus[k]['installed']) {
                if (!blamIgnore.ignored(k)) {
                    $scope.ignoreCandItemList.push(k);
                }
            }
        }
    }

    // "Add to Ignore List" button
    $scope.onAddIgnBtnClicked = function ($event) {
        blamIgnore.addItem($scope.ignoreCandListSelect);
        updateIgnoreList($scope);
        blamIgnore.saveTo(IGNORE_ADDONS_DB);
    };

    // "Remove From Ignore List" button
    $scope.onRmIgnBtnClicked = function ($event) {
        blamIgnore.removeItem($scope.ignoreListSelect);
        updateIgnoreList($scope);
        blamIgnore.saveTo(IGNORE_ADDONS_DB);
    };

    $scope.isAddonListActive = function (index) {
        if ($scope.addonListActive == undefined) {
            $scope.onAddonListSelectorChanged(0);
        }
        return $scope.addonListActive == index;
    };

    $scope.isAddonCategoryActive = function (index) {
        if ($scope.addonCategoryActive == undefined) {
            $scope.onAddonCategorySelectorChanged(0);
        }
        return $scope.addonCategoryActive[index];
    };

    $scope.onAddonListSelectorChanged = function (index) {
        $scope.activeAddonList = $scope.addonLists[index].value;
        $scope.addonListActive = index;
        onAddonSelectorChanged();
    };

    $scope.onAddonCategorySelectorChanged = function (index) {
        if ($scope.addonCategoryActive == undefined) {
            $scope.addonCategoryActive = Array.apply(null, Array($scope.addonCategories.length)).map(() => {return false});
        }
        $scope.addonCategoryActive[index] = !$scope.addonCategoryActive[index];
        onAddonSelectorChanged();
    };

    $scope.onSearchBarUpdated = (event) => {
        $scope.searchStr = event.target.value;
        onAddonSelectorChanged();
    };


    $scope.blStr = (content, str) => {
        if (str != BL_INFO_UNDEF) { return str; }
        var def = {
            'title': "(No Title)",
            'description': "(No Description)",
            'author': "(Annonymous)",
            'bl-version': "-",
            'version': "-",
            'category': "-"
        };
        return def[content];
    };

    $scope.getAddonStatus = (key) => {
        return $scope.addonStatus[key]['status'][$scope.targetDir];
    };

    $scope.onOpenCustomDirBtnClicked = () => {
        const remote = electron.remote;
        const dialog = remote.dialog;
        dialog.showOpenDialog(null, {
            properties: ['openDirectory'],
            title: 'Select Custom Add-on Folder',
            defaultPath: '.'
        }, (folderName) => {
            $scope.newCustomDir = folderName;
            redrawApp($scope);
        });
    };

    function updateCustomDirList($scope) {
        $scope.customDirItemList = blamCustomDir.getList();
        $scope.customDir = blamCustomDir.getTarget();
        $scope.newCustomDir = "";
    }

    $scope.onAddCustomDirBtnClicked = () => {
        let dir = $scope.newCustomDir;
        for (let i = 0; i < dir.length; ++i) {
            let d = dir[i];
            if (!Utils.isDirectory(d)) { continue; }
            blamCustomDir.addItem(d);
        }
        updateCustomDirList($scope);
        blamCustomDir.saveTo(CUSTOM_DIR_DB);
    };

    $scope.onRmCustomDirBtnClicked = () => {
        blamCustomDir.removeItem($scope.customDirListSelect);
        updateCustomDirList($scope);
        blamCustomDir.saveTo(CUSTOM_DIR_DB);
        updateInstalledAddonDB($scope);
    };

    $scope.onSetCustomDirBtnClicked = () => {
        blamCustomDir.setTarget($scope.customDirListSelect);
        updateCustomDirList($scope);
        blamCustomDir.saveTo(CUSTOM_DIR_DB);
        updateInstalledAddonDB($scope);
    };

    $scope.onMngCustomDirBtnClicked = () => {
        showCustomdirListPopup($scope);
    };


    function onAddonSelectorChanged() {
        // collect filter condition
        let activeList = $scope.addonLists[$scope.addonListActive]['value'];
        let activeCategory = [];
        let searchStr = $scope.searchStr;

        if ($scope.addonCategoryActive != undefined) {
            let idx = $scope.addonCategoryActive.indexOf(true);
            while (idx != -1) {
                activeCategory.push($scope.addonCategories[idx]['value']);
                idx = $scope.addonCategoryActive.indexOf(true, idx + 1);
            }
        }
        
        if ($scope.blVerSelect === 'Custom') {
            $scope.targetDir = $scope.customDir;
        }
        else {
            $scope.targetDir = $scope.blVerSelect;
        }

        // update add-on info
        let addons = [];
        switch (activeList) {
            case 'installed':
                logger.category('app').info("Show Installed add-on list");
                if ($scope.addonStatus) {
                    addons = Blam.filterAddons(
                        $scope.addonStatus,
                        'installed',
                        ['INSTALLED', 'UPDATABLE'],
                        $scope.targetDir,
                        activeCategory,
                        searchStr,
                        blamIgnore.getList());
                    addons = Blam.sortAddons(
                        $scope.addonStatus,
                        addons,
                        'installed',
                        $scope.addonOrderItemSelect.value,
                        $scope.addonOrder,
                        );
                }
                $scope.addonInfoTpl = 'partials/addon-info/installed.html';
                break;
            case 'github':
                logger.category('app').info("Show GitHub add-on list");
                if ($scope.addonStatus) {
                    addons = Blam.filterAddons(
                        $scope.addonStatus,
                        'github',
                        ['INSTALLED', 'NOT_INSTALLED', 'UPDATABLE'],
                        $scope.targetDir,
                        activeCategory,
                        searchStr,
                        blamIgnore.getList());
                    addons = Blam.sortAddons(
                        $scope.addonStatus,
                        addons,
                        'github',
                        $scope.addonOrderItemSelect.value,
                        $scope.addonOrder);
                }
                $scope.addonInfoTpl = 'partials/addon-info/github.html';
                break;
            case 'update':
                logger.category('app').info("Show Updatable add-on list");
                if ($scope.addonStatus) {
                    addons = Blam.filterAddons(
                        $scope.addonStatus,
                        'installed',
                        ['UPDATABLE'],
                        $scope.targetDir,
                        activeCategory,
                        searchStr,
                        blamIgnore.getList());
                }
                $scope.addonInfoTpl = 'partials/addon-info/github.html';
                break;
            default:
                return;
        }
        if (addons.length > 100) {
            addons.length = 100;
        }
        main.repoList = addons;


        function onLnBtnClicked($event) {
            let repoIndex = $($event.target).data('repo-index');
            let repo = $scope.addonStatus[main.repoList[repoIndex]]['github'];
            let url = repo['url'];
            electron.shell.openExternal(url);
        }

        function onDlBtnClicked($event) {
            setTaskAndUpdate($scope, 'INSTALL');
            let repoIndex = $($event.target).data('repo-index');
            let repo = $scope.addonStatus[main.repoList[repoIndex]]['github'];
            let key = main.repoList[repoIndex];
            $scope.isOpsLocked = true;
            installAddon($scope, key, repo, () => {
                try {
                    advanceProgressAndUpdate($scope);
                    updateInstalledAddonDB($scope);
                    advanceProgressAndUpdate($scope);
                    $scope.isOpsLocked = false;
                    completeTask($scope, repo['bl_info']['name']);
                }
                catch (e) {
                    handleException($scope, e);
                }
            });
        }

        function onRmBtnClicked($event) {
            try {
                setTaskAndUpdate($scope, 'REMOVE');
                let repoIndex = $($event.target).data('repo-index');
                let repo = $scope.addonStatus[main.repoList[repoIndex]]['installed'][$scope.targetDir];
                $scope.isOpsLocked = true;
                removeAddon($scope, repo);
                advanceProgressAndUpdate($scope);
                updateInstalledAddonDB($scope);
                $scope.isOpsLocked = false;
                completeTask($scope, repo['bl_info']['name']);
            }
            catch (e) {
                handleException($scope, e);
            }
        }

        function onUpBtnClicked($event) {
            setTaskAndUpdate($scope, 'UPDATE');
            let repoIndex = $($event.target).data('repo-index');
            let repoInstalled = $scope.addonStatus[main.repoList[repoIndex]]['installed'][$scope.targetDir];
            let repoGitHub = $scope.addonStatus[main.repoList[repoIndex]]['github'];
            let key = main.repoList[repoIndex];
            $scope.isOpsLocked = true;
            try {
                removeAddon($scope, repoInstalled);
            }
            catch (e) {
                handleException($scope, e);
            }
            installAddon($scope, key, repoGitHub, () => {
                try {
                    advanceProgressAndUpdate($scope);
                    updateInstalledAddonDB($scope);
                    advanceProgressAndUpdate($scope);
                    $scope.isOpsLocked = false;
                    completeTask($scope, repoGitHub['bl_info']['name']);
                }
                catch (e) {
                    handleException($scope, e);
                }
            });
        }

        // "Link" button
        $scope.onLnBtnClicked = onLnBtnClicked;
        // "Download" button
        $scope.onDlBtnClicked = onDlBtnClicked;
        // "Remove" button
        $scope.onRmBtnClicked = onRmBtnClicked;
        // "Update" button
        $scope.onUpBtnClicked = onUpBtnClicked;

    }


    async function initApp() {
        $scope.isOpsLocked = true;
        redrawApp($scope);

        // setup users directory
        if (!Utils.isExistFile(DB_DIR)) { fs.mkdirSync(DB_DIR); }
        if (!Utils.isExistFile(CONFIG_DIR)) { fs.mkdirSync(CONFIG_DIR); }

        // make config.json
        if (!Utils.isExistFile(CONFIG_FILE_PATH)) {
            fs.writeFileSync(CONFIG_FILE_PATH, CONFIG_FILE_INIT);
        }

        // read configuration file
        let text = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
        config = JSON.parse(text);
        // configure
        blamDB.configure(config);

        // make installed add-on DB
        if (!Utils.isExistFile(INSTALLED_ADDONS_DB)) {
            blamLocal.update();
            blamLocal.saveTo(INSTALLED_ADDONS_DB);
        }

        // make github add-on DB
        if (!Utils.isExistFile(GITHUB_ADDONS_DB)) {
            let proxyURL = Utils.getProxyURL(config);
            let apiURLs = Utils.getAPIURL(config);

            if (!apiURLs) { throw new Error("Invalid API URL"); }

            const version = await blamDB.makeAPIStatusFile(API_VERSION_FILE);
            const fetch = await blamDB.fetchFromServer(apiURLs, proxyURL);

            blamDB.saveTo(GITHUB_ADDONS_DB);
        }

        loadGitHubAddonDB();
        loadInstalledAddonsDB();
        loadIgnoreAddonDB();
        loadCustomDirDB();
        $scope.addonStatus = Blam.updateAddonStatus(blamDB.getAddonList(),
                                                    blamLocal.getAddonList(),
                                                    $scope.blVerList);

        updateIgnoreList($scope);
        updateCustomDirList($scope);

        onAddonSelectorChanged();

        $scope.isOpsLocked = false;
        redrawApp($scope);
    }


    initApp();

    $scope.closeIgnoreListPopup = () => {
        hideIgnoreListPopup($scope);
    };

    $scope.closeErrorPopup = () => {
        hideErrorPopup($scope);
    };

    $scope.closeCustomDirListPopup = () => {
        hideCustomdirListPopup($scope);
    };

    async function updateGitHubAddonDB($scope) {
        let proxyURL = Utils.getProxyURL(config);
        let apiURLs = Utils.getAPIURL(config);

        if (!apiURLs) { throw new Error("Invalid API URL"); }

        $scope.isOpsLocked = true;
        redrawApp($scope);

        // create DB files directory
        if (!Utils.isExistFile(DB_DIR)) {
            fs.mkdirSync(DB_DIR);
        }

        // update DB files
        const version = await blamDB.makeAPIStatusFile(API_VERSION_FILE);
        const fetch = await blamDB.fetchFromServer(apiURLs, proxyURL);

        blamDB.saveTo(GITHUB_ADDONS_DB);

        // update app's internal DB data
        $scope.addonStatus = Blam.updateAddonStatus(blamDB.getAddonList(),
                                                    blamLocal.getAddonList(),
                                                    $scope.blVerList);
        onAddonSelectorChanged();

        // unlock app
        $scope.isOpsLocked = false;
        redrawApp($scope);
    }

    $scope.changedAddonOrder = onAddonSelectorChanged;

});
