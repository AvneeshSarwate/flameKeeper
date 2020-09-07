let audioElements = [];
let gains = []; 
let delays = []; 
let oscillators = [];

const AudioContext = window.AudioContext || window.webkitAudioContext
const audioCtx = new AudioContext();

function createSingleAudioElement() {
    const audio = new Audio();
    audio.autoplay = false;
    audio.crossOrigin = 'anonymous';
    audioElements.push(audio);
    document.body.appendChild(audio);
}

createSingleAudioElement();


/*
ORDER OF TESTING EVENTS - 
1. click begin button (text, "load audio")
2. click test-play button (text, "play audio element")

Observed behavior
- Audio elements fail to play when USE_WEB_AUDIO is true.
- However, oscillator still plays when USE_WEB_AUDIO is true.
- Unexpected: Oscillator doesn't play after first click, but after second. 
- Unexpected: Oscillator only plays after both buttons have been pressed (IN EITHER ORDER)
*/ 

document.getElementById('begin').addEventListener('click', setUpAudio);
document.getElementById('test-play').addEventListener('click', playAudio);

function setUpAudio(){
    audioCtx.resume().then(() => {
        console.log("audio context resumed");
        setURLToElement(0);
        document.getElementById('message').innerText = "audio set up";
    });
}

let USE_WEB_AUDIO = true;
let CREATE_DEBUG_OSCILLATOR = true;

function setURLToElement(slotIndex){
    const audio = audioElements[slotIndex];
    audio.src = `https://flamekeeper.s3.amazonaws.com/c886dd70-0a31-424c-a094-e050852facb4-owenwowson.mp3`;
    audio.loop = true;

    if(USE_WEB_AUDIO){
        const source = audioCtx.createMediaElementSource(audio);

        const compressor = audioCtx.createDynamicsCompressor();
        const gain = audioCtx.createGain();
        gain.gain.value = 1; //audioData[slotIndex].volume;
        gains.push(gain);

        const delay = audioCtx.createDelay(5);
        delay.delayTime.value = 0; //waveforms[slotIndex].delay;
        delays.push(delay);
        
        compressor.threshold.setValueAtTime(-10, audioCtx.currentTime);
        compressor.knee.setValueAtTime(40, audioCtx.currentTime);
        compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
        compressor.attack.setValueAtTime(0, audioCtx.currentTime);
        compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

        source.connect(gain).connect(delay).connect(compressor).connect(audioCtx.destination);

        if(CREATE_DEBUG_OSCILLATOR){
            let osc = audioCtx.createOscillator();
            osc.connect(audioCtx.destination);
            osc.start();
            oscillators.push(osc);
        }
    }
}

function playAudio() {
    audioElements.map(a => a.play());
    console.log("audio elements played");
    document.getElementById('message').innerText = "play button hit";
}