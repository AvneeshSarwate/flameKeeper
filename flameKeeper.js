const { state } = require('./state');

class FlameKeeper {
    constructor() {
        this.ghostComposerID = "6ff99cc4-61f0-4007-aa25-a2e5121b9d1d";
        this.freqMilliseconds = 5000; // Check for state change every 5s
        this.lockoutTimeMilliseconds = 1000 * 60 * 60 * 7; // Lockout composer for 7h after every edit
        this.ghostTimeoutMilliseconds = 1000 * 60 * 60 * 14; // Ghost operates after 14h from last edit
        this.locked = false; // Determines ability for a composer to edit the state
        this.updateCounter = 0;
    }

    start() {
        console.log("Starting FlameKeeper");
        this.interval = setInterval(this.checkState.bind(this), this.freqMilliseconds);
    }

    stop() {
        clearInterval(this.interval);
    }

    async checkState() {
        // Update via log every minute
        let update = false;
        if (this.updateCounter == (60000 / this.freqMilliseconds)) update = true;

        let lastEditDate = new Date(state.lastEdit);
        let lockoutDate = new Date(lastEditDate.getTime() + this.lockoutTimeMilliseconds);
        let ghostDate = new Date(lastEditDate.getTime() + this.ghostTimeoutMilliseconds);
        let sinceLastEditMilliseconds = Date.now() - state.lastEdit;

        // Within 7 hours since last edit
        if (sinceLastEditMilliseconds < this.lockoutTimeMilliseconds) {
            if (update) console.log(`[${new Date(Date.now()).toISOString()}]`, "FlameKeeper: composer locked out until", lockoutDate.toISOString(), "(last edit on", lastEditDate.toISOString() + ")");
            this.locked = true;
        } // Between 7 and 14 hours since last edit
        else if (sinceLastEditMilliseconds < this.ghostTimeoutMilliseconds) {
            if (update) console.log(`[${new Date(Date.now()).toISOString()}]`, "FlameKeeper: composer edit window open until", ghostDate.toISOString(), "(last edit on", lastEditDate.toISOString() + ")");
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
        // Ensure state is populated with at least some audio and a currentState
        if (state.audio.length > 0 && state.currentState.audio && state.currentState.audio.length > 0) {
            console.log(`[${new Date(Date.now()).toISOString()}]`, "FlameKeeper: composer window closed without edit, making ghost edit");
            let randomAudio = state.audio[Math.floor(Math.random() * state.audio.length)];
            let newOffset = Math.random() * randomAudio.lengthSeconds;
            let newAudio = [...state.currentState.audio];
            let newIndex = Math.floor(Math.random() * newAudio.length);
            newAudio[newIndex] = {
                "audioID": randomAudio.audioID,
                "offset": newOffset
            }
            try {
                let edited = await state.editCurrentState(this.ghostComposerID, newAudio);
                if (!edited) {
                    console.error("unable to make ghost edit");
                }
            } catch (err) {
                console.error("unable to make ghost edit", err);
            }
        }
    }
}

exports.flameKeeper = new FlameKeeper();