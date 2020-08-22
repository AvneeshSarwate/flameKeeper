const express = require('express');
const router = express.Router();

const { state } = require('../state');
const { Composers } = require('../airtable');
const { getLogger } = require('../logger');

const logger = getLogger("main");

const FAR_FUTURE = 999999999999999; // Thu Sep 26 33658 21:46:39 GMT-0400 (Eastern Daylight Time)

router.get('/', function (req, res, next) {
    let currentAudio = [ ...state.currentState.audio ];
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
    
    res.render('index', {
        nonce: res.locals.nonce,
        audio: currentAudio
    });
});

router.get('/history', function (req, res, next) {
    let composerID = req.query.composerID;
    let from = parseInt(req.query.from) || 0; // Default to entire history
    let to = parseInt(req.query.to) || FAR_FUTURE; // Default to entire history
    let limit = parseInt(req.query.limit) || Number.MAX_SAFE_INTEGER;
    let offset = parseInt(req.query.offset) || 0;

    let composers = Composers.composers;
    let history;
    if (composerID) history = state.history.filter(h => h.composerID == composerID);
    else history = state.history; 
    
    // Filter history to time window
    history = history.filter(h => h.timestamp > from && h.timestamp < to);

    // Filter history for limit and offset
    history = history.slice(offset, Math.min(offset + limit, history.length));

    // Get composer data for those contained in history
    historyComposerIDs = [ ...new Set(history.map(h => h.composerID)) ];
    historyComposers = composers.filter(c => historyComposerIDs.includes(c.composerID));

    res.render("history", {
        history: history,
        historyComposers: historyComposers
    });
});

router.get('/past-composers', function (req, res, next) {
    let composerID = req.query.composerID;
    let from = parseInt(req.query.from) || 0; // Default to entire history
    let to = parseInt(req.query.to) || FAR_FUTURE; // Default to entire history
    let limit = parseInt(req.query.limit) || Number.MAX_SAFE_INTEGER;
    let offset = parseInt(req.query.offset) || 0;

    let composers = Composers.composers;
    let history;
    if (composerID) history = state.history.filter(h => h.composerID == composerID);
    else history = state.history; 
    
    // Filter history to time window
    history = history.filter(h => h.timestamp > from && h.timestamp < to);

    // Filter history for limit and offset
    history = history.slice(offset, Math.min(offset + limit, history.length));

    // Get composer data for those contained in history
    historyComposerIDs = [ ...new Set(history.map(h => h.composerID)) ];
    historyComposers = composers.filter(c => historyComposerIDs.includes(c.composerID));

    res.render("past_composers", {
        history: history,
        historyComposers: historyComposers,
        composerInfo: composers
    });
});

router.get('/composer', function (req, res, next) {
    let currentAudio = [ ...state.currentState.audio ];
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
    
    res.render('composer', {
        nonce: res.locals.nonce,
        audio: currentAudio,
        fileNames: JSON.stringify(currentAudio.map(a => a.filename))
    });
});

exports.mainRouter = router;
