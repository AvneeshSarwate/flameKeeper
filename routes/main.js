const express = require('express');
const router = express.Router();

const { state } = require('../state')

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

exports.mainRouter = router;
