// VISIT THIS SO FOR LISTS OF OVER 1000: https://menno.io/posts/listing-s3-objects-with-nodejs/

const fs = require('fs');
const stringify = require('csv-stringify')
const neatCsv = require('neat-csv');

let listComposers = function () {

  // Load the SDK for JavaScript
  const AWS = require('aws-sdk');

  // Set the Region 
  AWS.config.update({
    region: 'us-east-1'
  });

  // Create S3 service object
  s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    maxRetries: 10
  });


  // DEFINE YOUR RETURN THE PARAMS!!!!!!!!
  let bucketParams = {
    Bucket: 'fk-composer-info-dev',
    MaxKeys: 1000
    // StartAfter: startingFile  
  };



  const dataList = [];
  listAllKeys();

  function listAllKeys() {
    s3.listObjectsV2(bucketParams, function (err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
      } else {
        let filesToWrite = this.data.Contents

        setTimeout(() => {
          let dataToPush = [];
          let columns = {
            id: 'id',
            name: 'Name'
          };
          let id = -1;

          for (let i = 0; i < filesToWrite.length; i++) {
            id++
            dataToPush.push([id.toString(10), filesToWrite[i].Key])
          }

          // data.push([global.snapShotId, fileToAppend]);

          stringify(dataToPush, {
            header: true,
            columns: columns
          }, (err, output) => {
            if (err) throw err;
            fs.writeFile('pastComposers.csv', output, (err) => {
              if (err) throw err;
              console.log('pastComposers.csv saved.');
            })
          });
        }, 2000);



        // if (data.IsTruncated) {
        //   bucketParams.ContinuationToken = data.NextContinuationToken;
        //   console.log("get further list...");
        //   listAllKeys();
        // }
      }
    });
  }


};

exports.list_composers = listComposers;