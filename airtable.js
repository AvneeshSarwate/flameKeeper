const Airtable = require('airtable');

class Composers {
    constructor() {
        this.tableName = "Composers";
        this.baseID = "appiuLzmVDcFCntEr";
        this.base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(this.baseID);
        this.composers = this.base(this.tableName);
        this.composers.select({
            view: 'Grid view'
        }).eachPage((records, fetchNextPage) => {
            records.forEach(record => {
                console.log("Composer", record);
            })
            fetchNextPage();
        })
            .then(() => console.log("fetched all Composers"))
            .catch(err => console.log("unable to get Composers", err));
    }
}

module.exports = Composers;