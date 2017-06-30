'use strict';


import fs from 'fs';
import path from 'path';

import BlamDB from 'blam-db';
const blamDB = new BlamDB();
import DBWriter from 'blam-db-writer';
const dbWriter = new DBWriter();
dbWriter.init();

const CONFIG_FILE = process.cwd() + '/config.json';

let minPage = 1;
let maxPage = 100;
let nPagesPerCmd = 5;
let minFileSize = 0;
let maxFileSize = 100 * 1024 * 1024;
let nFileSizePerCmd = 500;
let waitInterval = 40 * 1000;   // 40sec

let config;

function zeroPadding(str, digit) {
    let s = '';
    for (let i = 0; i < digit; ++i) {
        s += '0';
    }
    s += str;
    return s.slice(-digit);
}

function getDate() {
    let date = new Date();
    let year = date.getYear() + 1900;
    let mon = date.getMonth() + 1;
    let day = date.getDate();
    let hour = date.getHours();
    let min = date.getMinutes();
    let sec = date.getSeconds();

    return "["
        + zeroPadding(year, 4)
        + "."
        + zeroPadding(mon, 2)
        + "."
        + zeroPadding(day, 2)
        + " "
        + zeroPadding(hour, 2)
        + ":"
        + zeroPadding(min, 2)
        + ":"
        + zeroPadding(sec, 2)
        + "]";
}

async function collectBlAddon(startPage, endPage, startFileSize, endFileSize) {
    try {
        let ret;

        blamDB.setPages(startPage, endPage);
        blamDB.setFileSizes(startFileSize, endFileSize);
        ret = await blamDB.buildAddonDB();
        ret = await blamDB.writeToDB(dbWriter);
    }
    catch (e) {
        console.log(e);
    }
}

function execCmd(size, page) {
    let startPage = page;
    let endPage = page + nPagesPerCmd - 1;
    let startFileSize = size;
    let endFileSize = size + nFileSizePerCmd - 1;

    let param = 'Page=' + startPage + '-' +endPage + ', FileSize=' + startFileSize + '-' + endFileSize;
    console.log(getDate() + " " + param);
    collectBlAddon(startPage, endPage, startFileSize, endFileSize);

    let nextFileSize = size;
    let nextPage = page + nPagesPerCmd;

    if (nextPage > maxPage) {
        nextFileSize = size + nFileSizePerCmd;
        nextPage = minPage;
    }
    if (nextFileSize > maxFileSize) {
        return;
    }

    setTimeout(() => { execCmd(nextFileSize, nextPage) }, waitInterval);
}


let text;

text = fs.readFileSync(CONFIG_FILE, 'utf8');
console.log("Parsing configuration file ...");
config = JSON.parse(text);
console.log("Parsed configuration file ...");

blamDB.configure(config, minPage, minPage, minFileSize, minFileSize);

execCmd(minFileSize, minPage);
