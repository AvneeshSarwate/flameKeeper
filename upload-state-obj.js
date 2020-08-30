const s3 = require('./s3');
const fs = require('fs');
const constants = require('./constants');

async function upload() {
    let filename = `state.json`;
    let file = fs.readFileSync('./state.json');
    let uploadParams = {
        Bucket: constants.BUCKET_NAME,
        Key: constants.STATE_FILENAME,
        Body: file.toString()
    };

    try {
        await s3.upload(uploadParams).promise();
        console.log(`uploaded ${filename}`);
    } catch (err) {
        console.log(`unable to upload ${filename} to S3`, err);
    }
}

upload()