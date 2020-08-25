const crypto = require('crypto');
const Airtable = require('airtable');
const { asyncForEach } = require('./util');
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const baseID = "appiuLzmVDcFCntEr";
const base = airtable.base(baseID);
const { getLogger } = require('./logger');

class Composers {
    constructor() {
        this.logger = getLogger("Composers");
        this.tableName = "Composers";
        this.composerTable = base(this.tableName);
        this.getComposers();
    }

    async getComposers() {
        this.composers = [];
        try {
            let records = await this.composerTable.select({
                view: 'Grid view'
            }).all();
            await asyncForEach(records, async record => {
                let composer = this.parseComposer(record);
                if (!composer.key) {
                    composer = await this.setComposerKey(composer)
                    this.composers.push(composer);
                }
                else this.composers.push(composer);
            });
            this.logger.debug("composers loaded");
        } catch (err) {
            this.logger.error("unable to get composers", err);
        }
        return this.composers;
    }

    setComposerKey(composer) {
        return new Promise((resolve, reject) => {
            this.composerTable.update(composer.id, {
                "key": crypto.randomBytes(16).toString('hex')
            }).then(record => {
                resolve(this.parseComposer(record));
            }).catch(err => reject(err));
        });
    }

    parseComposer(record) {
        let photo;
        let photoRecord = record.get("photo");
        if (photoRecord && photoRecord.length > 0) photo = photoRecord[0].url;
        return {
            "id": record.id,
            "composerID": record.get("composerID"),
            "name": record.get("name"),
            "bio": record.get("bio"),
            "photo": photo,
            "key": record.get("key"),
            "active": record.get("active") || false
        };
    }
}

class Admins {
    constructor() {
        this.logger = getLogger("Admins");
        this.tableName = "Admins";
        this.adminTable = base(this.tableName);
        this.getAdmins();
    }

    async getAdmins() {
        this.admins = [];
        try {
            let records = await this.adminTable.select({
                view: 'Grid view'
            }).all();
            await asyncForEach(records, async record => {
                let admin = this.parseAdmin(record);
                this.admins.push(admin);
            });
            this.logger.debug("admins loaded");
        } catch (err) {
            this.logger.error("unable to get admins", err);
        }
        return this.composers;
    }

    parseAdmin(record) {
        return {
            "name": record.get("name"),
            "key": record.get("key"),
            "active": record.get("active") || false
        };
    }
}

class AirtableManager {
    constructor() {
        this.logger = getLogger("AirtableManager");
        this.composers = new Composers();
        this.admins = new Admins();
        this.updateFreq = 2000;
        this.start();
    }

    start() {
        this.logger.info(`starting airtable sync every ${this.updateFreq / 1000}s`);
        this.interval = setInterval(this.sync.bind(this), this.updateFreq);
    }

    stop() {
        clearInterval(this.interval);
    }

    async sync() {
        try {
            await this.composers.getComposers();
            await this.admins.getAdmins();
            this.logger.debug("successfully re-synced airtable data");
        } catch (err) {
            logger.error(err);
        }
    }
}

let airtableManager = new AirtableManager();

exports.Composers = airtableManager.composers;
exports.Admins = airtableManager.admins;
exports.AirtableManager = airtableManager;
