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

    let loadedSlotTimestamp = historySlot ? historySlot.timestamp : state.currentState.timestamp

    let composerID = historySlot ? historySlot.composerID : state.currentState.composerID;
    let composer = Composers.composers.filter(c => c.composerID === composerID)[0];
    if (loadedAudio.includes(undefined)) {
        logger.error("unable to find currentState audioID in uploaded audio");
        res.sendStatus(500);
    }

    let historyTimes = state.history.map(h => h.timestamp);
    historyTimes.sort();
    let firstEntry = historyTimes[0];
    
    res.render('index', {
        nonce: res.locals.nonce,
        audio: JSON.stringify(loadedAudio),
        fileNames: JSON.stringify(loadedAudio.map(a => a.filename)),
        composerInfo: composer,
        timestamp: loadedSlotTimestamp,
        firstEntry
    });
});


router.get('/getInfo', function (req, res, next) {
    //TODO history - add query string val of history timestamp to pull composer info and audio files
    let historyTimestamp = parseInt(req.query.history) || 0;
    let historySlot = state.history.filter(h => h.timestamp < historyTimestamp ).slice(-1)[0];

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

    let timestamp = historySlot ? historySlot.timestamp : state.lastEdit;
    
    res.send({loadedAudio, composer, timestamp});
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
    // Copy composers object
    let composers = [ ...Composers.composers ];

    // For each composer, chronologically enumerate each timestamp of composer's historical states
    //  and add them to the composer object
    composers.forEach(c => {
        let sortedComposerStates = state.history
                                    .filter(s => s.composerID == c.composerID)
                                    .sort((s1, s2) => s1.timestamp < s2.timestamp)
        let enumeratedComposerTimestamps = sortedComposerStates.map((s, i) => [s.timestamp, i]);
        c.history = enumeratedComposerTimestamps || [];
    });

    res.render("past_composers", {
        composerInfo: composers,
        nonce: res.locals.nonce
    });
});

exports.mainRouter = router;
