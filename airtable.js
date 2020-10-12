const crypto = require('crypto');
const Airtable = require('airtable');
const { asyncForEach, markdownToHTML } = require('./util');
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const baseID = "appiuLzmVDcFCntEr";
const base = airtable.base(baseID);
const { getLogger } = require('./logger');

class Composers {
    constructor() {
        this.logger = getLogger("Composers");
        this.tableName = "Composers";
        this.composerTable = base(this.tableName);
        this.composers = [];
        this.getComposers();
    }

    async getComposers() {
        let composers = [];
        try {
            let records = await this.composerTable.select({
                view: 'Grid view'
            }).all();
            await asyncForEach(records, async record => {
                let composer = this.parseComposer(record);
                if (!composer.key) {
                    composer = await this.setComposerKey(composer)
                    composers.push(composer);
                }
                else composers.push(composer);
            });
            this.logger.debug("composers loaded");
        } catch (err) {
            this.logger.error(`unable to get composers: ${err}`);
        }
        this.composers = composers;
        return this.composers;
    }

    setComposerKey(composer) {
        return new Promise((resolve, reject) => {
            this.composerTable.update(composer.composerID, {
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
            "composerID": record.id,
            "name": record.get("name"),
            "bio": markdownToHTML(record.get("bio")),
            "photo": photo,
            "key": record.get("key"),
            "active": record.get("active") || false
        };
    }

    isValidAccessCode(accessCode) {
        let composer = this.composers.find(c => c.key == accessCode);
        if (composer) {
            if (composer.active) return { composer };
            return { error: "The access code provided is no longer valid." };
        } else return { error: "The access code provided was not recognized." };
    }

    isActive(composerID) {
        let composer = this.composers.find(c => c.composerID == composerID);
        if (composer && composer.active) return true;
        return false;
    }
}

class Admins {
    constructor() {
        this.logger = getLogger("Admins");
        this.tableName = "Admins";
        this.adminTable = base(this.tableName);
        this.admins = [];
        this.getAdmins();
    }

    async getAdmins() {
        let admins = [];
        try {
            let records = await this.adminTable.select({
                view: 'Grid view'
            }).all();
            await asyncForEach(records, async record => {
                let admin = this.parseAdmin(record);
                admins.push(admin);
            });
            this.logger.debug("admins loaded");
        } catch (err) {
            this.logger.error("unable to get admins", err);
        }
        this.admins = admins;
        return this.admins;
    }

    parseAdmin(record) {
        return {
            "adminID": record.id,
            "name": record.get("name"),
            "role": record.get("role"),
            "description": markdownToHTML(record.get("description")),
            "key": record.get("key"),
            "active": record.get("active") || false
        };
    }

    isValidAccessCode(accessCode) {
        let admin = this.admins.find(c => c.key == accessCode);
        if (admin) {
            if (admin.active) return { admin };
            return { error: "The access code provided is no longer valid." };
        } else return { error: "The access code provided was not recognized." };
    }

    isActive(adminID) {
        let admin = this.admins.find(a => a.adminID == adminID);
        if (admin && admin.active) return true;
        return false;
    }
}

class Copy {
    constructor() {
        this.logger = getLogger("Copy");
        this.tableName = "Copy";
        this.copyTable = base(this.tableName);
        this.copy = {};
        this.getCopy();
    }

    async getCopy() {
        let copy = {};
        try {
            let records = await this.copyTable.select({
                view: 'Grid view'
            }).all();
            await asyncForEach(records, async record => {
                let section = record.get("section");
                let sectionCopy;
                switch (section) {
                    case "title":
                    case "subtitle":
                        sectionCopy = record.get("copy");
                        break;
                    case "introduction":
                    case "how-it-works":
                        sectionCopy = markdownToHTML(record.get("copy"));
                        break;
                    default:
                        sectionCopy = record.get("copy");
                }
                if (section) copy[section] = sectionCopy;
            });
        } catch (err) {
            this.logger.error("unable to get copy", err);
        }
        this.copy = copy;
        return this.copy;
    }
}

class Gradient {
    constructor() {
        this.logger = getLogger("Copy");
        this.tableName = "Gradient";
        this.gradientTable = base(this.tableName);
        this.gradient = {};
        this.getGradient();
    }

    async getGradient() {
        let gradient = {};
        try {
            let records = await this.gradientTable.select({
                view: 'Grid view'
            }).all();
            await asyncForEach(records, async record => {
                let property = record.get("Property");
                let value = record.get("Value");
                gradient[property] = value;
            });
        } catch (err) {
            this.logger.error("unable to get copy", err);
        }
        this.gradient = gradient;
        return this.gradient;
    }
}

class AirtableManager {
    constructor() {
        this.logger = getLogger("AirtableManager");
        this.composers = new Composers();
        this.admins = new Admins();
        this.copy = new Copy();
        this.gradient = new Gradient();
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
            await this.copy.getCopy();
            await this.gradient.getGradient();
            this.logger.debug("successfully re-synced airtable data");
            console.log("composers", this.composers.composers);
        } catch (err) {
            logger.error(err);
        }
    }
}

let airtableManager = new AirtableManager();

exports.Composers = airtableManager.composers;
exports.Admins = airtableManager.admins;
exports.Copy = airtableManager.copy;
exports.Gradient = airtableManager.gradient;
exports.AirtableManager = airtableManager;
