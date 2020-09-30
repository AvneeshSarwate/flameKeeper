const express = require('express');
const router = express.Router();
const { IncomingForm } = require('formidable');

const { state } = require('../state')
const { Composers, Admins, Gradient } = require('../airtable');
const { sessionStore } = require('../app');
const { getLogger } = require('../logger');
const { flameKeeper } = require('../flameKeeper');

const logger = getLogger("admin");

const isLoginActive = function(req) {
    let authenticatedUser = req.session.composer || req.session.admin;
    if (!authenticatedUser) return false;
    let authenticatedID = authenticatedUser.composerID || authenticatedUser.adminID;
    if (Composers.isActive(authenticatedID) || Admins.isActive(authenticatedID)) return true;
    else return false;
}


// Middleware for checking if a session is authorized
const requiresLogin = function (req, res, next) {
    if (isLoginActive(req)) {
        return next();
    }
    if (req.method == "GET") req.session.returnTo = req.originalUrl;
    else req.session.returnTo = undefined;
    res.redirect('/login');
};

exports.requiresLogin = requiresLogin;


router.get('/login', function (req, res, next) {
    if (isLoginActive(req)) {
        res.redirect(req.session.returnTo || '/composer');
        return;
    }

    res.render('login', {
        nonce: res.locals.nonce
    });
});


router.post('/login', function (req, res, next) {
    const accessCode = req.body.accessCode;

    // Check if admin
    let loggedIn = Admins.isValidAccessCode(accessCode);
    if (loggedIn.admin) {
        req.session.admin = loggedIn.admin;
        res.redirect(req.session.returnTo || '/composer');
        return
    }

    // Check if composer
    loggedIn = Composers.isValidAccessCode(accessCode);
    if (loggedIn.composer) {
        req.session.composer = loggedIn.composer;
        res.redirect(req.session.returnTo || '/composer');
        return
    }

    res.render('login', { error: loggedIn.error });
    return;
});


router.get('/logout', requiresLogin, function (req, res, next) {
    req.session.composer = undefined;
    req.session.admin = undefined;
    res.redirect('/login');
});


router.get('/composer', requiresLogin, function (req, res, next) {
    let currentAudio = [...state.currentState.audio];
    currentAudio = currentAudio.map(a => {
        let audio = state.audio.find(aObj => aObj.audioID == a.audioID);
        if (!audio) {
            logger.error("unable to find audio for audioID", a.audioID);
            return undefined;
        }
        return {
            ...audio,
            ...a
        }
    });
    if (currentAudio.includes(undefined)) {
        logger.error("unable to find currentState audioID in uploaded audio");
        res.sendStatus(500);
    }

    // let currentComposerHistory = state.history.filter(h => h.composerID === state.currentState.composerID);
    // let showMultiFile = currentComposerHistory.length === 0 || (currentComposerHistory.length === 1 && withinEditTimeWindow)
    // let lastState = currentComposerHistory.sort((a, b) => a.timestamp-b.timestamp).slice(-1)[0] || [];
    // let withinEditTimeWindow = req.query.inWindow === 'true'; //todo avneesh - add this - both in time AND lastState is in window
    // let undoState = withinEditTimeWindow ? lastState : []; //if within edit time window, provide a state to undo to

    //todo - see if history contains latest uploaded state
    // currentAudio = lastState.audio;

    res.render('composer', {
        nonce: res.locals.nonce,
        admin: req.session.admin,  // Admin if an admin is logged in
        composer: req.session.composer,  // Composer if a composer is logged in
        audio: JSON.stringify(currentAudio),
        fileNames: JSON.stringify(currentAudio.map(a => a.filename)),
        timestamp: state.currentState.timestamp,
        isLocked: flameKeeper.locked,
        lastEditTime: state.lastEdit 
        // isMultiFile: showMultiFile || req.query.multi === 'true',
        // undoState: JSON.stringify(undoState)
    });
});

router.get('/gradient', function(req, res, next) {
    res.send(Gradient.gradient);
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
        if (flameKeeper.locked) {
            let authenticatedUser = req.session.composer || req.session.admin;
            let authenticatedID = authenticatedUser.composerID || authenticatedUser.adminID;
            let msg = `composer or admin ${authenticatedID} attempted upload when flameKeeper is locked`;
            logger.warn(msg);
            res.status(403).send(msg);
            return
        }

        await new Promise((resolve, reject) => {
            new IncomingForm().parse(req, async (err, fields, files) => {
                if (err) {
                    reject(`form parsing error: ${err}`);
                    return;
                }
                try {
                    if (!files.file) {
                        reject("no file found");
                        return;
                    }
                    // Don't check against current state or else transition is impossible
                    // if(fields.composerID !== state.currentState.composerID) {
                    //     let msg = `composer or admin ${fields.composerID} attempted upload when current composer is ${state.currentState.composerID}`;
                    //     logger.warn(msg);
                    //     res.status(403).send(msg);
                    //     return
                    // }
                    let file = files.file;
                    let index = parseInt(fields.index);
                    if (!index == null || index < 0 || index > 6) {
                        reject(`index must be 0-6, received ${index}`);
                        return;
                    }
                    let volume = parseFloat(fields.volume);
                    if (!volume == null || volume < 0 || volume > 2) {
                        reject(`volume must be 0-2, received ${volume}`);
                        return;
                    }
                    let audioID = await state.addAudio(file.name, file.path, req.session.composer.composerID);
                    let newAudio = [ ...state.currentState.audio ];
                    newAudio[index] = {
                        "audioID": audioID,
                        "volume": volume
                    };
                    await state.editCurrentState(req.session.composer.composerID, newAudio);
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
        res.status(400).send(err);
        return
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
