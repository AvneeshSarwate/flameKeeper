const express = require('express');
const router = express.Router();

const { state } = require('../state');
const { Composers } = require('../airtable');
const { getLogger } = require('../logger');

const logger = getLogger("main");

const FAR_FUTURE = 999999999999999; // Thu Sep 26 33658 21:46:39 GMT-0400 (Eastern Daylight Time)

router.get('/', function (req, res, next) {
    //TODO history - add query string val of history timestamp to pull composer info and audio files
    let historyTimestamp = parseInt(req.query.history) || 0;
    let historySlot = state.history.filter(h => h.timestamp === historyTimestamp)[0];

    let loadedAudio = historySlot ? historySlot.audio : [ ...state.currentState.audio ];
    loadedAudio = loadedAudio.map(a => {
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

    let composerID = historySlot ? historySlot.composerID : state.currentState.composerID;
    let composer = Composers.composers.filter(c => c.composerID === composerID)[0];

    if (loadedAudio.includes(undefined)) {
        logger.error("unable to find currentState audioID in uploaded audio");
        res.sendStatus(500);
    }
    
    res.render('index', {
        nonce: res.locals.nonce,
        audio: loadedAudio,
        composerInfo: composer
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
    let composers = Composers.composers.map(c => Object.assign({}, c));
    let composerHistories = {};
    state.history.forEach(h => {
        if(!composerHistories[h.composerID]) composerHistories[h.composerID] = [];
        composerHistories[h.composerID].push(h.timestamp);
    }); 

    console.log("compoesr histories", composerHistories)

    composers.forEach(c => {
        if(composerHistories[c.composerID]) {
            composerHistories[c.composerID].sort();
            composerHistories[c.composerID] = composerHistories[c.composerID].map((e, i) => [e, i]);
        }
        c.history = composerHistories[c.composerID] || [];
        console.log("c", c);
    });

    

    res.render("past_composers", {
        composerInfo: composers,
        composerHistories,
        nonce: res.locals.nonce
    }, 
    (err, html) => {
        console.log("error:", err);
        res.send(html);
    });

    console.log("yo")
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

    let currentComposerHistory = state.history.filter(h => h.composerID === state.currentState.composerID);
    let showMultiFile = currentComposerHistory.length === 0 || (currentComposerHistory.length === 1 && withinEditTimeWindow)
    let lastState = currentComposerHistory.sort((a, b) => a.timestamp-b.timestamp).slice(-1)[0] || [];
    let withinEditTimeWindow = req.query.inWindow === 'true'; //todo avneesh - add this - both in time AND lastState is in window
    let undoState = withinEditTimeWindow ? lastState : []; //if within edit time window, provide a state to undo to

    //todo - see if history contains latest uploaded state
    currentAudio = lastState.audio;

    res.render('composer', {
        nonce: res.locals.nonce,
        audio: JSON.stringify(currentAudio),
        fileNames: JSON.stringify(currentAudio.map(a => a.filename)),
        isMultiFile: showMultiFile || req.query.multi === 'true',
        undoState: JSON.stringify(undoState)
    });
});

exports.mainRouter = router;
