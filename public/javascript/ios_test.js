let audioElements = [];
let gains = []; 
let delays = []; 

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
    }
}

function playAudio() {
    audioElements.map(a => a.play());
    console.log("audio elements played");
    document.getElementById('message').innerText = "play button hit";
}


(function() {
	window.AudioContext = window.AudioContext || window.webkitAudioContext;
	if (window.AudioContext) {
		window.audioContext = new window.AudioContext();
	}
	var fixAudioContext = function (e) {
		if (window.audioContext) {
			// Create empty buffer
			var buffer = window.audioContext.createBuffer(1, 1, 22050);
			var source = window.audioContext.createBufferSource();
			source.buffer = buffer;
			// Connect to output (speakers)
			source.connect(window.audioContext.destination);
			// Play sound
			if (source.start) {
				source.start(0);
			} else if (source.play) {
				source.play(0);
			} else if (source.noteOn) {
				source.noteOn(0);
			}
		}
		// Remove events
		document.removeEventListener('touchstart', fixAudioContext);
		document.removeEventListener('touchend', fixAudioContext);
	};
	// iOS 6-8
	document.addEventListener('touchstart', fixAudioContext);
	// iOS 9
	document.addEventListener('touchend', fixAudioContext);
})();