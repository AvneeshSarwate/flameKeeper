const showdown = require("showdown");
showdown.setFlavor("github");
const converter = new showdown.Converter();

exports.asyncForEach = async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};

exports.isEmptyObject = function (obj) {
  return !Object.keys(obj).length;
};

exports.markdownToHTML = function (text) {
  return converter.makeHtml(text);
};
