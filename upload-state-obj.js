const dotenv = require("dotenv");
dotenv.config();
const s3 = require("./s3");
const fs = require("fs");
const constants = require("./constants");
// const AWS = require('aws-sdk');

async function upload() {
  let filename = `state.json`;
  let file = fs.readFileSync(`./${filename}`);
  let uploadParams = {
    Bucket: constants.BUCKET_NAME,
    Key: filename,
    Body: file.toString(),
  };

  try {
    await s3.upload(uploadParams).promise();
    console.log(`uploaded ${filename}`);
  } catch (err) {
    console.log(`unable to upload ${filename} to S3`, err);
  }
}

upload();
// AWS.config.getCredentials(function(err) {
//     if (err) console.log(err.stack);
//     // credentials not loaded
//     else {
//       console.log("Access key:", AWS.config.credentials.accessKeyId);
//     }
//   });
