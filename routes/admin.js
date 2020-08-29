const express = require('express');
const router = express.Router();
const { IncomingForm } = require('formidable');

const { state } = require('../state')
const { Composers, Admins } = require('../airtable');
const { sessionStore } = require('../app');
const { getLogger } = require('../logger');

const logger = getLogger("admin");

// Middleware for checking if a session is authorized..
const requiresLogin = function (req, res, next) {
    if (req.session.composerAuthenticated || req.session.adminAuthenticated) {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
};

exports.requiresLogin = requiresLogin;


router.get('/login', function (req, res, next) {
    if (req.session.composerAuthenticated || req.session.adminAuthenticated) {
        res.redirect('/dashboard');
        return;
    }

    res.render('login', {
        nonce: res.locals.nonce
    });
});


router.post('/login', function (req, res, next) {
    const accessCode = req.body.accessCode;

    // Check if admin
    let admins = Admins.admins;
    let admin = admins.find(a => a.key == accessCode);
    if (admin) {
        if (admin.active) {
            req.session.adminAuthenticated = true;
            req.session.admin = admin;
            res.redirect('/dashboard');
            return
        }
    }

    // Check if composer
    let composers = Composers.composers;
    let composer = composers.find(c => c.key == accessCode);
    let err;
    if (composer) {
        if (composer.active) {
            req.session.composerAuthenticated = true;
            req.session.composer = composer;
            res.redirect('/dashboard');
            return
        }
        err = "The access code provided is no longer valid.";
    } else {
        err = "The access code provided was not recognized.";
    }
    res.render('login', { error: err });
});


router.get('/logout', requiresLogin, function (req, res, next) {
    req.session.composerAuthenticated = false;
    req.session.composer = undefined;
    req.session.adminAuthenticated = false;
    req.session.admin = undefined;
    res.redirect('/login');
});


router.get('/dashboard', requiresLogin, function (req, res, next) {
    res.render('admin-dashboard', {
        admin: req.session.admin,
        composer: req.session.composer
    });
});

// todo - post data will be an object with fields "vol-i","file-i", where this psuedo-diff
// is applied to the current state to generate the new state.
// Also, it will contain an "is-replace" field so multiple edits within an edit window dont 
// create multiple history entries
router.post('/upload', requiresLogin, async function (req, res, next) {
    try {
        await new Promise((resolve, reject) => {
            new IncomingForm().parse(req, async (err, fields, files) => {
                if (err) {
                    reject(`form parsing error: ${err}`);
                }
                try {
                    if (!files.file) {
                        reject("no file found");
                        return;
                    }
                    let file = files.file;
                    let index = parseInt(fields.index);
                    if (!index || index < 0 || index > 6) {
                        reject("index must be 0-6");
                        return;
                    }
                    let volume = parseFloat(fields.volume);
                    if (!volume || volume < 0 || volume > 1) {
                        reject("volume must be 0-1");
                        return;
                    }
                    let audioID = await state.addAudio(file.name, file.path);
                    let newAudio = [ ...state.currentState.audio ];
                    newAudio[index] = {
                        "audioID": audioID,
                        "volume": volume
                    };
                    await state.editCurrentState(req.session.composer.id, newAudio);
                } catch (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
        res.redirect('/dashboard');
    } catch (err) {
        logger.error(err);
        res.redirect('/dashboard');
        // TODO: display error
    }
});


router.post('/airtable', requiresLogin, async function (req, res, next) {
    try {
        await Composers.getComposers();
        await Admins.getAdmins();
        await sessionStore.clear();
        logger.info("session storage cleared");
        res.redirect('/login');
    } catch (err) {
        logger.error(err);
        res.redirect('/dashboard');
        // TODO: display error
    }
});

exports.adminRouter = router;
