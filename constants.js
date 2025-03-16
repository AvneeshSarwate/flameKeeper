exports.BUCKET_NAME = "flamekeepers";
exports.STATE_FILENAME = process.env.STATE_FILENAME;

exports.filenameToS3URL = (filename) =>
  `https://${this.BUCKET_NAME}.s3.amazonaws.com/${filename}`;
