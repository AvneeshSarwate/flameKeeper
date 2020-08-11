const List = require('../models/list');
const ListComposers = require('../models/pastComposers')
const Upload = require('../models/upload');
const Intern = require('../models/intern-upload');
const Delete = require('../models/delete');
const Replace = require('../models/replace');
const Substitute = require('../models/subFile');
const AppendDoc = require('../models/appendDoc');
const AppendIntern = require('../models/appendIntern');
const UpdateIntern = require('../models/updateIntern');
const DeleteIntern = require('../models/deleteIntern');
const DeleteBucket = require('../models/deleteBucket');
const DeletePhoto = require('../models/deletePhoto');
const DeleteDoc = require('../models/deleteDoc');
const SnapshotAppend = require('../models/snapshotAppend');

const StandardizedAudioContext = require('standardized-audio-context');


const formidable = require('formidable');
const fs = require('fs');

const neatCsv = require('neat-csv');


global.dashboardLock = true;



// REPLACE function when submitting from composer page
exports.replace_function = function (req, res) {
  function replacedFile() {
    Replace.replace_file({
      value: req.params.id
    })
    return new Promise(resolve => {
      setTimeout(function () {
        resolve(res.redirect('/dashboard'))
      }, 2000)
    })
  }
  replacedFile(),


    function (err, results) {
      res.send('ERRONEOUS!');
    }
}


// Home page list AUDIO files
exports.list_function = function (req, res) {
  function getList() {
    fs.readFile('./homePage.csv', async (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      let dataToTreat = await neatCsv(data);
      fileInfo = dataToTreat;            
      return fileInfo;
    });    
    

    return new Promise(resolve => {
      setTimeout(function () {        
        resolve(res.render('index', {
          audioContext: StandardizedAudioContext,
          fileInfo: fileInfo
        }));
      }, 2000)
    })
  }
  getList(),

    function (err, results) {
      res.send('ERRONEOUS!');
    }
}

// DISPLAY selected files to the home page upon submit
exports.dashboard_function = function (req, res) {
  function getDash() {
    fs.readFile('./homePage.csv', async (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      let dataToTreat = await neatCsv(data);
      fileInfo = dataToTreat;
      return fileInfo;

    })

    fs.readFile('./fileTracker.csv', async (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      let dataToTreat2 = await neatCsv(data);
      fileInfo2 = dataToTreat2;
      return fileInfo2;

    });

    return new Promise(resolve => {
      setTimeout(function () {
        resolve(res.render('dashboard', [fileInfo, fileInfo2]))
      }, 2000)
    })
  }
  getDash(),

    function (err, results) {
      res.send('ERRONEOUS!');
    }
}

// UPLOAD page
exports.upload_function = function (req, res, next) {
  function getList() {
    fs.readFile('./fileTracker.csv', async (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      let dataToTreat = await neatCsv(data);
      console.log(dataToTreat);
    })
  }

  new formidable.IncomingForm().parse(req)
    .on('field', (name, field) => {
      // res.status(415).send(field);      
    })
    .on('file', (name, file) => {
      function uploadFile() {
        Upload.upload_files({
          name: 'fk-audio-dev',
          fileName: file.name,
          fileToUpload: file.path
        });
        return new Promise(resolve => {
          setTimeout(function () {
            resolve(res.redirect('upload-form'))
          }, 2000)
        })
      }
      getList(),
      uploadFile(),
      AppendDoc.append_csv(global.uploadFileLabel),


        function (err, results) {
          res.send('ERRONEOUS!');
        }
    })

    .on('success', (name, field) => {
      console.log('Field')
    })
}

exports.delete_function = function (req, res, next) {
  global.uploadLock = 1;

  function deleteLast() {
    Delete.delete_file({
      name: 'fk-audio-dev',
      id: req.params.id,
    });
    return new Promise(resolve => {
      setTimeout(function () {
        resolve(res.redirect('/upload-form'))
      }, 2000)
    })
  }
  deleteLast(),
    DeleteDoc.delete_csv(),


    function (err, results) {
      res.send('ERRONEOUS!');
    };
}

exports.intern_form = function (req, res) {
  // ListComposers.list_composers();
  function getList() {
    fs.readFile('./pastComposers.csv', async (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      let dataToTreat = await neatCsv(data);
      fileInfo = dataToTreat;
      return fileInfo;
    })

    fs.readFile('./bucketStuff.csv', async (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      let bucketData = await neatCsv(data);
      bucketStuff = bucketData;
      return bucketStuff;
    })
    
    fs.readFile('./snapshot.csv', async (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      let snapShotData = await neatCsv(data);
      snapResults = snapShotData;
      snaps = [];
      const map = new Map();
      for (const item of snapResults) {
        if (!map.has(item.id)) {
          map.set(item.id, true); // set any value to Map
          snaps.push({
            id: item.id,
            date: item.Date
          });
        }
      }
      return snaps;
    })

    return new Promise(resolve => {
      setTimeout(function () {
        resolve(res.render('intern-form', [fileInfo, bucketStuff, snaps]));
      }, 2000)
    })
  }
  getList(),

    function (err, results) {
      res.send('ERRONEOUS!');
    }
}

exports.intern_update = function (req, res) {
  const uploadInfo = {
    id: req.body.id,
    Name: req.body.Name,
    Composer: req.body.Composer,
    StartSlice: req.body.StartSlice,
    EndSlice: req.body.EndSlice,
    Bio: req.body.Bio

  }
  UpdateIntern.update_intern(uploadInfo);
  return new Promise(resolve => {
    setTimeout(function () {
      resolve(res.redirect('/intern-form'))
    }, 2000)
  }),
  function (err, results) {
    res.redirect('/intern-form');
  };
}

exports.intern_delete = function (req, res) {
  const deleteInfo = {
    id: req.body.id,
    Name: req.body.Name,
    Composer: req.body.Composer,
    StartSlice: req.body.StartSlice,
    EndSlice: req.body.EndSlice,
    Bio: req.body.Bio
  }
  DeleteIntern.delete_intern(deleteInfo);
  return new Promise(resolve => {
    setTimeout(function () {
      resolve(res.redirect('/intern-form'))
    }, 2000)
  })
}

exports.delete_photo = function (req, res) {   
  function deleteLast() {
    DeleteBucket.delete_bucket(req.body.file),
    DeletePhoto.delete_photo({
      id: req.body.file
    });
    return new Promise(resolve => {
      setTimeout(function () {
        resolve(res.redirect('/intern-form'))
      }, 2000)
    })
  }
  deleteLast(),
  

    function (err, results) {
      res.send('ERRONEOUS!');
    };
}


// INTERN UPLOAD page
exports.intern_upload_function = function (req, res, next) {
  function getList() {
    fs.readFile('./pastComposers.csv', async (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      let dataToPush = await neatCsv(data);
    });    
  }

  new formidable.IncomingForm().parse(req)
    .on('field', (name, field) => {
      // res.status(415).send(field);      
    })
    .on('file', (name, file) => {
      function uploadFile() {
        Intern.intern_upload({
          name: 'fk-composer-info-dev',
          fileName: file.name,
          fileToUpload: file.path
        });
        return new Promise(resolve => {
          setTimeout(function () {
            resolve(res.redirect('/intern-form'))
          }, 2000)
        })
      }
      getList(),
        uploadFile(),
        AppendIntern.append_intern(global.internUploadLabel),


        function (err, results) {
          res.send('ERRONEOUS!');
        };
    })

    .on('success', (name, field) => {
      console.log('Field')
    });    
}


exports.past_composers_function = function (req, res) {
  // ListComposers.list_composers();
  function getList() {
    fs.readFile('./pastComposers.csv', async (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      let dataToTreat = await neatCsv(data);
      fileInfo = dataToTreat;
      return fileInfo;

    })

    fs.readFile('./snapshot.csv', async (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      let snapData = await neatCsv(data);
      snaps = snapData;
      return snaps;

    })

    return new Promise(resolve => {
      setTimeout(function () {
        resolve(res.render('past-composers', [fileInfo, snaps]));
      }, 2000)
    })
  }
  getList(),

    function (err, results) {
      res.send('ERRONEOUS!');
    }
}

exports.history_function = function (req, res) {
  function getList() {
    fs.readFile('./snapshot.csv', async (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      let dataToTreat = await neatCsv(data);
      fileInfo = dataToTreat;
      let startSlice = parseInt(req.params.id);
      slicedFiles = []
      for (let i = 0; i < fileInfo.length; i++) {
        if (fileInfo[i].id == startSlice) {
          slicedFiles.push(fileInfo[i])
        }
      }
      return slicedFiles
    });

    return new Promise(resolve => {
      setTimeout(function () {
        resolve(res.render('history', slicedFiles));
      }, 3000)
    })
  }
  getList(),

    function (err, results) {
      res.send('ERRONEOUS!');
    }
}

exports.cycle_function = function() {  
  if (global.stopTime == true || global.stopTime == undefined) {
    console.log('Interval cleared!');
    var today = new Date()
    console.log('INDICATION: ' + today.getHours() + ":" + today.getMinutes())
    clearInterval(global.myInterval);
    global.myInterval = setInterval(() => {
      Substitute.sub_file();
    }, 25200000);
    global.stopTime = false;
  } else {
    console.log('Interval started!');
    global.myInterval = setInterval(() => {
      Substitute.sub_file();
    }, 25200000);
    global.stopTime = true;
  }
}


exports.test_function = function (req, res) {
  List.list_files();
}
