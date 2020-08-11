const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

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
                "uploadedAt": "<timestamp>"
            }
        ],
        "currentState": {
            "composerID": "<guid>",
            "timestamp": "<timestamp>",
            "audio": [
                {
                    "audioID": "<guid>",
                    "start": 0.0
                },
                ... (x7)
            ]
        },
        "history": [
            {
                "composerID": "<guid>"
                "timestamp": "<timestamp>",
                "audio": [<audio>]
            }
        ]
    }
     */
    constructor(filename) {
        // Load object from file
        let data = fs.readFileSync(filename);
        let jsonData = JSON.parse(data);

        // Assign properties from file to this object
        Object.assign(this, jsonData);
    }

    async addAudio(name, path) {
        let id = uuidv4();
        let filename = `${id}-${name}`;
        let fileStream = fs.createReadStream(path);
        fileStream.on('error', err => console.log(`unable to read file ${path}`, err));
        let uploadParams = {
            Bucket: constants.BUCKET_NAME,
            Key: filename,
            Body: fileStream,
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
            "audioID": uuidv4(),
            "name": name,
            "filename": filename,
            "uploadedAt": Date.now()
        };
        this.audio.push(audio);
        return await this.save();
    }

    async editState(composerID, newAudio) {
        if (this.currentState) {
            let currentState = { ...this.currentState };
            this.history.push(currentState);
        }
        this.currentState = {
            composerID: composerID,
            timestamp: Date.now(),
            audio: newAudio 
        };
        return await this.save();
    }

    async save() {
        let stateString = JSON.stringify(this);
        let uploadParams = {
            Bucket: constants.BUCKET_NAME,
            Key: constants.STATE_FILENAME,
            Body: stateString,
            ACL: 'public-read',
        };
        try {
            await s3.upload(uploadParams).promise();
            return true;
        } catch (err) {
            console.error("unable to save state to S3", err);
            return false;
        }
    }
}

module.exports = State;