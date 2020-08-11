const crypto = require('crypto');
const Airtable = require('airtable');
const { asyncForEach } = require('./util');
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });

class Composers {
    constructor() {
        this.tableName = "Composers";
        this.baseID = "appiuLzmVDcFCntEr";
        this.base = airtable.base(this.baseID);
        this.composerTable = this.base(this.tableName);
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
        } catch (err) {
            console.error("unable to get Composers", err);
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

exports.Composers = Composers;
