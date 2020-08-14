const express = require('express');
const router = express.Router();
const { IncomingForm } = require('formidable');

const { state } = require('../state')
const { Composers, Admins } = require('../airtable');

const { sessionStore } = require('../app');

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

    res.render('login');
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


router.post('/upload', requiresLogin, async function (req, res, next) {
    try {
        await new Promise((resolve, reject) => {
            new IncomingForm().parse(req)
                .on('file', (_, file) => {
                    state.addAudio(file.name, file.path)
                        .then(ok => {
                            if (ok) resolve();
                            else reject("unable to add audio");
                        })
                        .catch(err => reject("unable to add audio", err));
                });
        });
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
        // TODO: display error
    }
});


router.post('/airtable', requiresLogin, async function (req, res, next) {
    try {
        await Composers.getComposers();
        await Admins.getAdmins();
        await sessionStore.clear();
        console.log("session storage cleared");
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
        // TODO: display error
    }
});

exports.adminRouter = router;
