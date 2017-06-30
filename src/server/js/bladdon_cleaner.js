'use strict';


import fs from 'fs';

import DBWriter from 'blam-db-writer';
const dbWriter = new DBWriter();
dbWriter.init();

const CONFIG_FILE = process.cwd() + '/config.json';

let config;

function isLinkDown(url, proxyURL) {
    return new Promise(function (resolve) {
        if (proxyURL) {
            request({
                    tunnel: true,
                    url: url,
                    json: true,
                    proxy: proxyURL
                }, (err, res, body) => {
                    if (res.statusCode === 404) {
                        resolve(true);
                    }
                    resolve(false);
                }
            );
        }
        else {
            request({
                    url: url,
                    json: true,
                }, (err, res, body) => {
                    if (res.statusCode === 404) {
                        resolve(true);
                    }
                    resolve(false);
                }
            );
        }
    });
}


let text;
let finished = false;

text = fs.readFileSync(CONFIG_FILE, 'utf8');
console.log("Parsing configuration file ...");
config = JSON.parse(text);
console.log("Parsed configuration file ...");

// cleanup link downed addons
async function cleanupAddons(cb) {
    let addonList = await dbWriter.find({});
    for (let i = 0; i < addonList.length; ++i) {
        let addon = addonList[i];
        let url = addon['url'];
        let key = addon['key'];
        let isDown = await isLinkDown(url);

        if (isDown) {
            let ret = await dbWriter.remove({'key': key});
        }
    }

    cb();
}

function markFinished() {
    finished = true;
}


