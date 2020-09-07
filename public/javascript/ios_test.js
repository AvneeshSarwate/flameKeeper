let audioElements = [];
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
    setURLToElement(0);
}

function setURLToElement(ind){
    audioElements[ind].src = `https://flamekeeper.s3.amazonaws.com/c886dd70-0a31-424c-a094-e050852facb4-owenwowson.mp3`;
    audioElements[ind].loop = true
}

function playAudio() {
    audioElements.map(a => a.play());
    console.log("audio elements played");
}