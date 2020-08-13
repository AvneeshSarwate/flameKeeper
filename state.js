const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const getMP3Duration = require('get-mp3-duration');

const s3 = require('./s3');
const constants = require('./constants');

class State {
    /* Spec:
    {
        "audio": [
            {
                "audioID": "<guid>",
                "name": "<filename>",
                "filename": "<guid>-<name>",
                "lengthSeconds": 0.0,
                "uploadedAt": <timestamp>
            }
        ],
        "currentState": {
            "composerID": "<guid>",
            "timestamp": <timestamp>,
            "audio": [
                {
                    "audioID": "<guid>",
                    "offset": 0.0
                },
                ... (x7)
            ]
        },
        "history": [
            {
                "composerID": "<guid>"
                "timestamp": <timestamp>,
                "audio": [<audio>]
            }
        ],
        "lastEdit": <timestamp>
    }
     */
    constructor() {
        // Signals whether the S3 file has been fetched
        this.loaded = false;
        this.load();
    }

    load() {
        if (this.loaded) return true;
        this.loaded = true;
        return new Promise((resolve, reject) => {
            let getParams = {
                Bucket: constants.BUCKET_NAME,
                Key: constants.STATE_FILENAME
            };
            s3.getObject(getParams).promise()
                .then(data => {
                    // Load object from file data
                    let jsonData = JSON.parse(data.Body);

                    // Save locally mostly for development purposes
                    let filename = `./${constants.STATE_FILENAME}`;
                    fs.writeFileSync(filename, JSON.stringify(jsonData, null, '\t'));

                    // Assign properties from file to this object
                    Object.assign(this, jsonData);
                    console.log("state loaded");
                    resolve();
                })
                .catch(err => reject(err));
        });
    }

    async addAudio(name, path) {
        let id = uuidv4();
        let filename = `${id}-${name}`;
        let file = fs.readFileSync(path);
        let uploadParams = {
            Bucket: constants.BUCKET_NAME,
            Key: filename,
            Body: file,
            ACL: 'public-read',
        };
        try {
            await s3.upload(uploadParams).promise();
            console.log(`uploaded ${filename}`);
        } catch (err) {
            console.error(`unable to upload ${filename} to S3`, err);
            return undefined;
        }

        let audio = {
            "audioID": id,
            "name": name,
            "filename": filename,
            "lengthSeconds": getMP3Duration(file) / 1000,
            "uploadedAt": Date.now()
        };
        this.audio.push(audio);
        return await this.save();
    }

    async editCurrentState(composerID, newAudio) {
        if (this.currentState) {
            let currentState = { ...this.currentState };
            this.history.push(currentState);
        }
        let now = Date.now();
        this.currentState = {
            composerID: composerID,
            timestamp: now,
            audio: newAudio
        };
        this.lastEdit = now;
        return await this.save();
    }

    async save() {
        // Remove properties we don't want to save
        let copy = { ...this };
        delete copy.loaded

        let stateString = JSON.stringify(copy);
        let uploadParams = {
            Bucket: constants.BUCKET_NAME,
            Key: constants.STATE_FILENAME,
            Body: stateString
        };
        try {
            await s3.upload(uploadParams).promise();
        } catch (err) {
            console.error("unable to save state to S3", err);
            return false;
        }

        // Save locally mostly for development purposes
        let stateStringPretty = JSON.stringify(copy, null, '\t');
        fs.writeFileSync(`./${constants.STATE_FILENAME}`, stateStringPretty);
        return true
    }
}

exports.state = new State();
