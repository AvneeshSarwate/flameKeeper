const audio_controller = require('../controllers/audioController');

let internUpload = function (name, fileToUpload, count) {  
  let x = name.fileName
  console.log('EX: ' + x);


  // Load the AWS SDK for Node.js
  const AWS = require('aws-sdk');
  // Set the region 
  AWS.config.update({
    region: 'us-east-1'
  });

  // Create S3 service object
  s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    maxRetries: 10
  });

  let uploadName = name.fileToUpload;
  
  const year = new Date().getFullYear()
  const month = new Date().getMonth();
  const day = new Date().getDay(); 
  const hour = new Date().getHours(); 
  const dateString = year.toString() + month.toString() + day.toString() + hour.toString();
  
  global.internUploadLabel = `${dateString}-${name.fileName}`;





  // call S3 to retrieve upload file to specified bucket
  let uploadParams = {
    Bucket: 'fk-composer-info-dev',
    Key: global.internUploadLabel,
    Body: uploadName,
    ACL: 'public-read',
  };

  let file = uploadParams.Body;




  // Configure the file stream and obtain the upload parameters

  const fs = require('fs');
  let fileStream = fs.createReadStream(file);
  fileStream.on('error', function (err) {
    console.log('File Error', err);
  });
  uploadParams.Body = fileStream;
  const path = require('path');
  // uploadParams.Key = path.basename(file);
  uploadParams.Key = global.internUploadLabel;  

  s3.upload(uploadParams, function (err, data) {
    if (err) {
      console.log("Error", err);
    }
    if (data) {
      console.log("Upload Success", data.key);
    }
  })
}






exports.intern_upload = internUpload;