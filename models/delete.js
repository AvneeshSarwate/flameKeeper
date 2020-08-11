let deleteFile = function (id) {
  if (global.uploadLock == true) {
    global.uploadLock = false;
    global.dashboardLock = true;
    

    // Load the AWS SDK for Node.js
    const AWS = require('aws-sdk');
    // Set the region 
    AWS.config.update({
      region: 'us-east-1'
    });

    // Create S3 service object
    s3 = new AWS.S3({
      apiVersion: '2006-03-01'
    });

    let params = {
      Bucket: 'fk-audio-dev',
      Key: id.id
      /* 
         where value for 'Key' equals 'pathName1/pathName2/.../pathNameN/fileName.ext'
         - full path name to your file without '/' at the beginning
      */
    };

    s3.deleteObject(params, function (err, data) {
      if (err) console.log(err); // an error occurred
      else console.log(data); // successful response
    });
  } else {console.log('You cannot delete!')}
}

exports.delete_file = deleteFile;