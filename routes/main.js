const express = require('express');
const router = express.Router();

const { state } = require('../state');
const { Composers } = require('../airtable');

const FAR_FUTURE = 999999999999999; // Thu Sep 26 33658 21:46:39 GMT-0400 (Eastern Daylight Time)

router.get('/', function (req, res, next) {
    let currentAudio = [ ...state.currentState.audio ];
    currentAudio = currentAudio.map(a => {
        let audio = state.audio.find(aObj => aObj.audioID == a.audioID);
        if (!audio) {
            console.log("unable to find audio for audioID", a.audioID);
            return undefined;
        }
        return {
            ...audio,
            ...a
        }
    });
    if (currentAudio.includes(undefined)) {
        console.log("unable to find currentState audioID in uploaded audio");
        res.sendStatus(500);
    }
    res.sendStatus(200);
    return
});

router.get('/history', function (req, res, next) {
    let composerID = req.query.composerID;
    let from = req.query.from || 0; // Default to entire history
    let to = req.query.to || FAR_FUTURE; // Default to entire history
    let limit = req.query.limit || Number.MAX_SAFE_INTEGER;
    let offset = req.query.offset || 0;

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

    res.render("history-test", {
        history: history,
        historyComposers: historyComposers
    });
});

exports.mainRouter = router;