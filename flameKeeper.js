const { state } = require('./state');
const { getLogger } = require('./logger');
const { Composers } = require('./airtable');
const STOP_GHOST = process.env.STOP_GHOST === "true";

class FlameKeeper {
    constructor() {
        this.logger = getLogger("FlameKeeper");
        this.ghostComposerID = "6ff99cc4-61f0-4007-aa25-a2e5121b9d1d";
        this.freqMilliseconds = 5000; // Check for state change every 5s
        this.lockoutTimeMilliseconds = 1000 * 60 * 60 * 7; // Lockout composer for 7h after every edit
        this.ghostTimeoutMilliseconds = 1000 * 60 * 60 * 14; // Ghost operates after 14h from last edit
        this.locked = false; // Determines ability for a composer to edit the state
        this.updateCounter = 0;
    }

    start() {
        this.logger.info("starting flamekeeper");
        this.interval = setInterval(this.checkState.bind(this), this.freqMilliseconds);
    }

    stop() {
        clearInterval(this.interval);
    }

    async checkState() {
        // Update via log every 10 minutes
        let update = false;
        if (this.updateCounter == ((600000 / this.freqMilliseconds) - 1)) update = true;

        let lastEditDate = new Date(state.lastEdit);
        let lockoutDate = new Date(lastEditDate.getTime() + this.lockoutTimeMilliseconds);
        let ghostDate = new Date(lastEditDate.getTime() + this.ghostTimeoutMilliseconds);
        let sinceLastEditMilliseconds = Date.now() - state.lastEdit;

        // Within 7 hours since last edit
        if (sinceLastEditMilliseconds < this.lockoutTimeMilliseconds) {
            if (update) this.logger.info(`FlameKeeper: composer locked out until ${lockoutDate.toISOString()} (last edit on ${lastEditDate.toISOString()})`);
            this.locked = true;
        } // Between 7 and 14 hours since last edit
        else if (sinceLastEditMilliseconds < this.ghostTimeoutMilliseconds) {
            if (update) this.logger.info(`FlameKeeper: composer edit window open until ${ghostDate.toISOString()} (last edit on ${lastEditDate.toISOString()})`);
            this.locked = false;
        } else {
            // Ghost edit
            await this.makeRandomEdit();
            this.locked = true;
        }

        if (update) this.updateCounter = 0;
        else this.updateCounter++;
    }

    async makeRandomEdit() {
        //for some development situations, we grant limited access and don't want the dev app to attempt ghost edits
        if(STOP_GHOST) return;

        // Ensure state is populated with at least some audio, an active composer, and a currentState
        if (state.audio.length > 0 &&
            Composers.composers.filter(c => c.active).length > 0 &&
            state.currentState.audio && state.currentState.audio.length > 0) {
            let activeComposer = Composers.composers.filter(c => c.active)[0];
            let activeComposerId = activeComposer.composerID;
            let activeComposerName = activeComposer.name;
            
            this.logger.info(`FlameKeeper: composer window closed without edit, making ghost edit for: ${activeComposerName} (${activeComposerId})`);
            let randomAudio = state.audio[Math.floor(Math.random() * state.audio.length)];
            let newVolume = 0.1 + Math.random() * 0.8; // Random between 0.1-0.9
            let newAudio = [...state.currentState.audio];
            let newIndex = Math.floor(Math.random() * newAudio.length);
            newAudio[newIndex] = {
                "audioID": randomAudio.audioID,
                "volume": newVolume
            }

            try {
                let edited = await state.editCurrentState(activeComposerId, newAudio);
                if (!edited) {
                    this.logger.error("unable to make ghost edit");
                }
            } catch (err) {
                this.logger.error("unable to make ghost edit", err);
            }
        }
    }
}

exports.flameKeeper = new FlameKeeper();