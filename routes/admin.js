const express = require('express');
const router = express.Router();
const { IncomingForm } = require('formidable');

const { state } = require('../state')
if (!state.loaded) state.load();

const { Composers } = require('../airtable');

// Middleware for checking if a session is authorized.
exports.requiresLogin = function (req, res, next) {
    if (req.session.authenticated) {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/admin/login');
};

router.get('/login', function (req, res, next) {
    res.render('composer-login');
});

router.get('/logout', function (req, res, next) {
    req.session.authenticated = false;
    req.session.composer = undefined;
    res.redirect('/admin/login');
});

router.post('/login', function (req, res, next) {
    if (req.session.authenticated) {
        res.redirect('/admin/dashboard');
        return
    }

    const accessCode = req.body.accessCode;
    let composers = Composers.composers;
    let composer = composers.find(c => c.key == accessCode);
    let err;
    if (composer) {
        if (composer.active) {
            req.session.authenticated = true;
            req.session.composer = composer;
            res.redirect('/admin/dashboard');
            return
        }
        err = "The access code provided is no longer valid.";
    } else {
        err = "The access code provided was not recognized.";
    }
    res.render('composer-login', { error: err });
});

router.get('/dashboard', function (req, res, next) {
    res.render('admin-dashboard');
});

router.post('/upload', async function (req, res, next) {
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
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
        // TODO: display error
    }
});

exports.adminRouter = router;
