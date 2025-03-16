const AWS = require("aws-sdk");

// Set the region
AWS.config.update({
  region: "us-east-1",
});

// Create S3 service object
module.exports = new AWS.S3({
  apiVersion: "2006-03-01",
  maxRetries: 1,
});
