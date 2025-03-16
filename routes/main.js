const express = require("express");
const router = express.Router();

const { state } = require("../state");
const { Composers, Admins, Copy } = require("../airtable");
const { getLogger } = require("../logger");
const { compose } = require("async");

const logger = getLogger("main");

const FAR_FUTURE = 999999999999999; // Thu Sep 26 33658 21:46:39 GMT-0400 (Eastern Daylight Time)

let filterAudio = function (loadedSlot) {
  let loadedAudio = loadedSlot.audio;
  loadedAudio = loadedAudio.map((a) => {
    let audio = state.audio.find((aObj) => aObj.audioID == a.audioID);
    if (!audio) {
      logger.error("unable to find audio for audioID", a.audioID);
      return undefined;
    }
    return {
      ...audio,
      ...a,
    };
  });

  let composerID = loadedSlot.composerID || undefined;
  var composer = undefined;
  if (composerID != undefined) {
    composer = Composers.composers.filter(
      (c) => c.composerID === composerID
    )[0];
  }
  if (loadedAudio.includes(undefined)) {
    logger.error("unable to find currentState audioID in uploaded audio");
    return undefined;
  }

  console.log("main.js", composer);

  return {
    loadedAudio,
    composer,
  };
};

router.get("/", function (req, res, next) {
  // Get audio and composer from timestamp, or current state
  let historyTimestamp = parseInt(req.query.history) || 0;
  let loadedSlot =
    state.history.filter((h) => h.timestamp === historyTimestamp)[0] ||
    state.currentState;

  let filteredAudio = filterAudio(loadedSlot);
  if (!filteredAudio) {
    res.sendStatus(500);
    return;
  }

  let loadedAudio = filteredAudio.loadedAudio;
  let composer = filteredAudio.composer;
  composer = Composers.composers.filter((c) => c.active)[0] || composer;
  let loadedSlotTimestamp = loadedSlot.timestamp;

  let historyTimes = state.history.map((h) => h.timestamp);
  historyTimes.sort();
  let firstEntry = historyTimes[0];

  let sortedComposerStates = state.history
    .filter((s) => s.composerID == composer.composerID)
    .sort((s1, s2) => s1.timestamp < s2.timestamp);
  sortedComposerStates = sortedComposerStates.map((e, i) => [e.timestamp, i]);

  res.render("index", {
    nonce: res.locals.nonce,
    copy: Copy.copy,
    admins: Admins.admins.filter((a) => a.active),
    audio: JSON.stringify(loadedAudio),
    fileNames: JSON.stringify(loadedAudio.map((a) => a.filename)),
    composerInfo: composer,
    allComposers: JSON.stringify(
      Composers.composers.map((c) => {
        return {
          composerID: c.composerID,
          photo: c.photo,
          name: c.name,
        };
      })
    ),
    timestamp: loadedSlotTimestamp,
    sortedComposerStates: sortedComposerStates,
    sortedComposerStates_str: JSON.stringify(sortedComposerStates),
    firstEntry,
  });
});

router.get("/getInfo", function (req, res, next) {
  //TODO history - add query string val of history timestamp to pull composer info and audio files
  let historyTimestamp = parseInt(req.query.history) || 0;
  let historySlot = state.history
    .filter((h) => h.timestamp < historyTimestamp)
    .slice(-1)[0];
  let loadedSlot = historySlot ? historySlot : state.currentState;

  let filteredAudio = filterAudio(loadedSlot);
  if (!filteredAudio) {
    res.sendStatus(500);
    return;
  }

  let loadedAudio = filteredAudio.loadedAudio;
  let composer = filteredAudio.composer;
  let timestamp = loadedSlot.timestamp;

  res.send({ loadedAudio, composer, timestamp });
});

router.get("/history", function (req, res, next) {
  let composerID = req.query.composerID;
  let from = parseInt(req.query.from) || 0; // Default to entire history
  let to = parseInt(req.query.to) || FAR_FUTURE; // Default to entire history
  let limit = parseInt(req.query.limit) || Number.MAX_SAFE_INTEGER;
  let offset = parseInt(req.query.offset) || 0;

  let composers = Composers.composers;
  let history;
  if (composerID)
    history = state.history.filter((h) => h.composerID == composerID);
  else history = state.history;

  // Filter history to time window
  history = history.filter((h) => h.timestamp > from && h.timestamp < to);

  // Filter history for limit and offset
  history = history.slice(offset, Math.min(offset + limit, history.length));

  // Get composer data for those contained in history
  historyComposerIDs = [...new Set(history.map((h) => h.composerID))];
  historyComposers = composers.filter((c) =>
    historyComposerIDs.includes(c.composerID)
  );

  res.render("history", {
    history: history,
    historyComposers: historyComposers,
  });
});

router.get("/past-composers", function (req, res, next) {
  // fill out state.json

  // Copy composers object
  let composers = [...Composers.composers];

  // For each composer, chronologically enumerate each timestamp of composer's historical states
  //  and add them to the composer object
  composers.forEach((c) => {
    let sortedComposerStates = state.history
      .filter((s) => s.composerID == c.composerID)
      .sort((s1, s2) => s1.timestamp < s2.timestamp);
    let enumeratedComposerTimestamps = sortedComposerStates.map((s, i) => [
      s.timestamp,
      i,
    ]);
    c.history = enumeratedComposerTimestamps;
  });

  res.render("past_composers", {
    copy: Copy.copy,
    composerInfo: composers,
    nonce: res.locals.nonce,
  });
});

exports.mainRouter = router;
