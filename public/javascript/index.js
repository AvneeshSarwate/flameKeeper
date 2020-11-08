const AudioContext = window.AudioContext || window.webkitAudioContext
const audioCtx = new AudioContext();

let isMobile = window.matchMedia("only screen and (max-width: 760px)").matches;

let waveWorker = new Worker('./javascript/wave_worker.js');

let swapClick = i => document.getElementById('fileSwap-'+i).click();
let controllerProps = {
    zoom0: 1.29,
    zoom1: 2.73,
    zoom2: 2.2,
    zoom3: 2.4,
    zoom4: 1.59,
    zoom5: 2.73,
    zoom6: 1.13,
    color1: [ 0, 128, 255 ],
    color2: [ 0, 128, 255 ],
    colorSpeed: 259,
    swap_file_0: () => {swapClick(0)},
    swap_file_1: () => {swapClick(1)},
    swap_file_2: () => {swapClick(2)},
    swap_file_3: () => {swapClick(3)},
    swap_file_4: () => {swapClick(4)},
    swap_file_5: () => {swapClick(5)},
    swap_file_6: () => {swapClick(6)},
    show_wave_numbers: false,
    prog0: 0,
    prog1: 0,
    prog2: 0,
    prog3: 0,
    prog4: 0,
    prog5: 0,
    prog6: 0,
    manualProg: false
};

const MAX_ZOOM_OUT = 3;

// var gui = new dat.GUI();
// [0, 1, 2, 3, 4, 5, 6].forEach(i => {
//     gui.add(controllerProps, 'zoom'+i, 0, MAX_ZOOM_OUT, 0.01).onFinishChange(v => {
//         waveforms[i].waveZoom = v;
//         // delays[i].delayTime.value = getVisualSyncDelay(i);
//     });
// });
// gui.addColor(controllerProps, 'color1');
// gui.addColor(controllerProps, 'color2');

// [0, 1, 2, 3, 4, 5, 6].forEach(i => {
//     gui.add(controllerProps, 'swap_file_'+i);
//     document.getElementById('fileSwap-'+i).addEventListener('change', (e) => {
//         replaceAudioSlotWithFile(e.target.files[0], i);
//     });
// });

// gui.add(controllerProps, 'show_wave_numbers').onChange(v => {
//     let visibility = v ? 'visible' : 'hidden';
//     let labels = document.getElementsByTagNameNS("http://www.w3.org/2000/svg", "text");
//     [0, 1, 2, 3, 4, 5, 6].forEach(i => {labels[i].style.visibility = visibility});
// });

// [0, 1, 2, 3, 4, 5, 6].forEach(i => {
//     gui.add(controllerProps, 'prog'+i, 0, 3, 0.01)
// });
// gui.add(controllerProps, 'manualProg')




document.getElementById('text_slider_display').innerHTML = new Date().toLocaleString();
document.getElementById('time_slider').addEventListener('input', changeTime);
document.getElementById('jump_to_history').addEventListener('click', jumpToHistory);
// document.getElementById('global_vol').addEventListener('input', changeVol);


//commenting out time slider for now - might need to change firstTimeStamp => firstEntry
// let urlHistory = new URLSearchParams(document.location.search).get('history');
// if(urlHistory){
//     document.getElementById('time-header').innerText = 
//         'The Curator At ' + new Date(parseInt(timestamp)).toLocaleString();    
//     let timeProg = (timestamp - firstTimestamp) / (Date.now() - firstTimestamp);
//     document.getElementById('time_slider').value = timeProg;
// }

// document.getElementById('beginButton').addEventListener('click', begin);
document.getElementById('fullscreen').addEventListener('click', goFullScreen);
document.getElementById('playAudio').addEventListener('click', playAudio);
document.getElementById('volumeIcon').addEventListener('click', muteAudio);
document.getElementById('muteIcon').addEventListener('click', unmuteAudio);

let transportStartTime = null;
let isPlaying = false;
function playAudio() {
    document.getElementById('user_controls').classList.remove('hide');
    document.getElementById('playAudio').classList.add('hide');
    Tone.start();
    Tone.Transport.start();
    Promise.all([playerPromises, drawPromises].flat()).then(() => {
        restartPlaybackAfterLoad(Date.now());
        isPlaying = true;
    });
}


let gloalVol = 1.0;
let muted = false;

function muteAudio() {
    document.getElementById('volumeIcon').classList.add('hide');
    document.getElementById('muteIcon').classList.remove('hide');
    muted = true;
    globalGain.gain.value = 0.0;
}

function unmuteAudio() {
    document.getElementById('muteIcon').classList.add('hide');
    document.getElementById('volumeIcon').classList.remove('hide');
    muted = false;
    globalGain.gain.value = gloalVol;
}

function restartPlaybackAfterLoad(startTime) {
    console.log("ready to play");
    let nowTime = Tone.Transport.now() + 0.25;
    transportStartTime = nowTime;
    players.map((p, i) => {
        let audioDur = p.buffer.length * p.sampleTime;
        let uploadedTimestamp = audioData[i].uploadedAt;
        let seekTime = ((startTime - uploadedTimestamp) / 1000) % audioDur;
        loopOffsets[i] = seekTime;
        p.start(nowTime);
        p.seek(seekTime+0.001, nowTime+0.001);
        delays[i].delayTime.value = getVisualSyncDelay(i);
    });
    Tone.Transport.scheduleOnce((_) => installationBlur.setStdDeviation(0, 0), nowTime);
}



let selected_waveform = null;
let audioElements = [];
let audioElementPromises = [];
let players = [];
let playerPromises = [];
let loopOffsets = [];
let loopTrackers = [];
let waveformGroups = [];
let gains = [];
let delays = [];
let file_is_replaced = false;
let lastVolume = null; //the previos volume of the slot was replaced. saved for undo in single-replace mode
let submissionData = {};
let candidateFileUrl = null;
let drawPromises = [];
let currentTime;
let installationBlur;
let drawPointBuffers = [];

function changeVol(value) {
    gloalVol = value;
    if (!muted) globalGain.gain.value = gloalVol;
}

function changeTime(e) {
    currentTime = (Date.now() - firstEntry) * parseFloat(e.target.value) + firstEntry;
    let newTimeString = new Date(currentTime).toLocaleString();
    document.getElementById('text_slider_display').innerHTML = newTimeString;
}

function jumpToHistory() {
    getInstallationByTimestamp(currentTime);
}

function resetWaveFromURL(filename, gainVal, audioTime, slotIndex){
    let url = `https://flamekeepers.s3.amazonaws.com/${filename}`;
    
    gains[slotIndex].gain.value = gainVal;
    let waveDrawPromise = animateAudioData(fetch(url), slotIndex);

    let playerPromise = players[slotIndex].load(url);

    return [playerPromise, waveDrawPromise];
}

function getInstallationByTimestamp(timestamp) {
    players.forEach(p => p.stop());
    fetch(document.location.origin + '/getInfo?history=' + timestamp)
        .then(response => response.json())
        .then(jsonData => {
            console.log(jsonData);

            document.getElementById('composer-name').innerText = jsonData.composer.name;
            document.getElementById('composer-bio').innerText = jsonData.composer.bio;
            document.getElementById('composer-photo').src = jsonData.composer.photo;
            document.getElementById('time-header').innerText = 'The Curator At ' + new Date(timestamp).toLocaleString();

            audioData = jsonData.loadedAudio;
            
            installationBlur.setStdDeviation(5, 5);
            let newPromises = audioData.map((ad, i) => resetWaveFromURL(ad.filename, ad.volume, timestamp, i)).flat();
            Promise.all(newPromises).then(() => {
                restartPlaybackAfterLoad(timestamp);
            })
        });
}

console.log("returns", returns);

// Configuration.
const CONTAINER_WIDTH = 600;
const CONTAINER_HEIGHT = 400;
const HPAD = 100;
const VPAD = 20;
const ZIGZAG_COLOR = "red";
const ZIGZAG_WIDTH = 1;
const ZIGZAG_V_LENGTH = Math.floor((CONTAINER_HEIGHT - VPAD * 2) / 3);
const ZIGZAG_H_LENGTH = Math.floor((CONTAINER_WIDTH - HPAD * 2) / 2);
const ZIGZAG_LOADING_EXPONENTIAL = 0.0025;
const SAMPLES_PER_SECOND = 120 * 0.25;
const PIXELS_PER_SECOND = 50;
const pixelsPerSample = PIXELS_PER_SECOND / SAMPLES_PER_SECOND;
const NORMALIZE_DATA = true;
const WAVEFORM_COLOR = "gray";
const HIGHLIGHT_COLOR = "#ff5050aa";
const TRANSPARENT_COLOR = "#ffffff00";

const DEBUG = false;

// Nice convenient way to describe the waveforms.
const waveforms = [
    {//Wave-0
        index: 0,
        url: `https://flamekeepers.s3.amazonaws.com/${returns[0]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 25.5,
        viewWidth: 290,
        transform: `rotate(0 145 30) translate(50 30)`,
        zIndex: -1,
        panAmount: -0.75,
        delay: 2.155, 
        waveZoom: 1.29,
        linePercent: 0.829 //248/299
    },
    {//Wave-1
        index: 1,
        url: `https://flamekeepers.s3.amazonaws.com/${returns[1]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 190,
        transform: `rotate(90 47.5 60) translate(97.5 -72.5)`,
        zIndex: -1,
        panAmount: 0.5,
        delay: 2.48, 
        waveZoom: 2.73,
        linePercent: 0.845 //376/445
    },
    {//Wave-2
        index: 2,
        url: `https://flamekeepers.s3.amazonaws.com/${returns[2]}`,
        speed: 15,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 200,
        transform: `rotate(0 100 30) translate(200 150)`,
        zIndex: -1,
        panAmount: 0.75,
        delay: 1.53, 
        waveZoom: 2.2,
        linePercent: 0.503 //420/835
    },
    {//Wave-3
        index: 3,
        url: `https://flamekeepers.s3.amazonaws.com/${returns[3]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 200,
        transform: `rotate(180 100 30) translate(-200 -195)`,
        zIndex: -1,
        panAmount: 0.25,
        delay: 1.35, 
        waveZoom: 2.4,
        linePercent: 0.503
    },
    {//Wave-4
        index: 4,
        url: `https://flamekeepers.s3.amazonaws.com/${returns[4]}`,
        speed: 10,
        mirrored: false,
        viewHeight: 30,
        viewWidth: 190,
        transform: `rotate(270 47.5 30) translate(-222.5 402.5)`,
        zIndex: -1,
        panAmount: 0,
        delay: 2.27, 
        waveZoom: 1.59,
        linePercent: 0.789 //359/455 
    },
    {//Wave-5
        index: 5,
        url: `https://flamekeepers.s3.amazonaws.com/${returns[5]}`,
        speed: 10,
        mirrored: false,
        viewHeight: 30,
        viewWidth: 190,
        transform: `rotate(270 47.5 15) translate(-237.5 447.5) scale(1 -1)`,
        zIndex: -1,
        panAmount: -0.25,
        delay: 0.47, 
        waveZoom: 2.73,
        linePercent: 0.789
    },
    {//Wave-6
        index: 6,
        url: `https://flamekeepers.s3.amazonaws.com/${returns[6]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 230,
        transform: `rotate(180 60 30) translate(-400 -310)`,
        zIndex: -1,
        panAmount: -0.5,
        delay: 0, 
        waveZoom: 1.13,
        linePercent: 0.911 //697/765
    }
];

// [0, 1, 2, 3, 4, 5, 6].map( i => {
//     waveforms[i].url = `./audio/FlameDrummer${i+1}.mp3`;
// })

waveWorker.postMessage(['waveforms', waveforms]);

function setGradient(speed, angle, colors, zooms){
    let speedString = speed+'s';
    let gradientString = `linear-gradient(${angle}deg, ${colors.join(', ')})`;
    let zoomString = zooms.join(" ");

    document.documentElement.style.setProperty('--gradient-speed', speedString);
    document.documentElement.style.setProperty('--gradient-def', gradientString);
    document.documentElement.style.setProperty('--background-size', zoomString);
}

function setFontColor(r, g, b, a) {
    document.documentElement.style.setProperty('--font-color', `rgba(${r}, ${g}, ${b}, ${a})`);
}

function refreshStyle() {
    fetch('/style').then(resp => {
        resp.json().then(style => {
            let speed = parseInt(style.gradient.speed);
            let angle = parseInt(style.gradient.angle);
            let colors = style.gradient.colors.split(/(\s+)/).filter(c => c[0] === "#");
            let zooms = style.gradient.zooms.split(/(\s+)/);
            setGradient(speed, angle, colors, zooms);

            let r = style.font.r;
            let g = style.font.g;
            let b = style.font.b;
            let a = style.font.a;
            setFontColor(r, g, b, a);
        })
    })
}

// Enable style changing from airtable TODO: remove
// setTimeout(() => {
//     setInterval(() => {
//         refreshStyle();
//     }, 2 * 1000);
// }, 1000 * 2);


function createZigZag() {
    const points = [
        [HPAD, VPAD],
        [HPAD, VPAD + ZIGZAG_V_LENGTH],
        [HPAD + ZIGZAG_H_LENGTH, VPAD + ZIGZAG_V_LENGTH],
        [HPAD + ZIGZAG_H_LENGTH, VPAD + ZIGZAG_V_LENGTH * 2],
        [HPAD + ZIGZAG_H_LENGTH * 2, VPAD + ZIGZAG_V_LENGTH * 2],
        [HPAD + ZIGZAG_H_LENGTH * 2, VPAD + ZIGZAG_V_LENGTH * 3]
    ]
        .map(([x, y]) => `${x},${y}`)
        .join(" ");

    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute('d', 'M' + points);
    path.setAttribute('id', 'zigZag');
    let pathLen = path.getTotalLength();
    path.style.fill = "none";
    path.style.stroke = ZIGZAG_COLOR;
    path.style.strokeWidth = ZIGZAG_WIDTH;
    path.style.strokeDashoffset = pathLen;
    path.style.strokeDasharray = pathLen + ',' + pathLen;

    return path;
}

let animationFrames = 0;
let startLoading;
let filesLoaded = 0;
let newFileLoaded = false;
let lastFileLoadedTimestamp;
let loadingAnimationCallback;

function startLoadingAnimation() {
    let loadingProgress = document.getElementById("loadingProgress");
    let zigZag = document.getElementById("zigZag");
    let { zigZagTop, zigZagLeft } = zigZag.getBoundingClientRect();
    loadingProgress.style.top = `${zigZagTop }px`;
    loadingProgress.style.left = `${zigZagLeft}px`;
    loadingProgress.classList.remove('hide');

    startLoading = Date.now();
    newFileLoaded = true;
    loadingAnimationCallback = requestAnimationFrame(animateLoading);
}

function updateLoadingAnimation() {
    filesLoaded += 1;
    newFileLoaded = true;
    if (filesLoaded == 7) {
        stopLoadingAnimation();
        let path = document.getElementById("zigZag");
        path.style.strokeDashoffset = 0;
        [0, 1, 2, 3, 4, 5, 6].map(i => {
            drawZeroLine(waveforms[i], document.getElementById("group-"+i))
        })
        document.getElementById('playAudio').classList.remove('hide2');
    }
}

function stopLoadingAnimation() {
    cancelAnimationFrame(loadingAnimationCallback);
    filesLoaded = 0;
    lastFileLoadedTimestamp = undefined;
    newFileLoaded = false;
    loadingProgress.classList.add('hide');
    console.log("loading animation frames", animationFrames);
    console.log("loading time", Date.now() - startLoading);
    console.log("loading animation avg FPS", animationFrames / (Date.now() - startLoading));
}

function animateLoading(t) {
    animationFrames += 1;

    if (newFileLoaded) {
        lastFileLoadedTimestamp = t;
        newFileLoaded = false;
    }

    // Get SVG path element and its length
    let path = document.getElementById("zigZag");
    let pathLen = path.getTotalLength();

    // When the next file is fully loaded the path
    //  should be this long
    let segmentLength = pathLen / 7;

    // Determine current length based on exponential approach
    //  to nextLengthMilestone
    let relT = t - lastFileLoadedTimestamp;
    let drawLen = (filesLoaded * segmentLength) + (segmentLength * (1 - (Math.E ** (-1 * ZIGZAG_LOADING_EXPONENTIAL * relT))))

    // Path length is drawn by setting the offset as pathLen - drawLen
    path.style.strokeDashoffset = Math.max(pathLen - drawLen, 0);

    // Update percentage
    let loadingValue = document.getElementById("loadingValue");
    let percentComplete = Math.round(100 * drawLen / pathLen);
    loadingValue.innerHTML = percentComplete;

    // Continue animating
    loadingAnimationCallback = requestAnimationFrame(animateLoading);
}

function animateAudioData(toneBuffer, slotIndex) {
    let wf = waveforms[slotIndex];
    let group = document.getElementById('group-' + slotIndex);

    return Promise.resolve(toneBuffer)
        .then(audioBuffer => visualize(audioBuffer, wf.viewHeight, slotIndex))
        .then(({ waveformWidth, svg }) => {
            let animateViewHeight = wf.viewHeight * 2;
            if (!wf.mirrored) {
                svg.setAttribute("height", wf.viewHeight);
                animateViewHeight = wf.viewHeight;
            }
            group.appendChild(svg);
            let slotFadeInAnimations = document.getElementsByClassName(`fadeIn-${wf.index}`);
            for (let a of slotFadeInAnimations) a.beginElement();
            animate(svg, waveformWidth, wf.viewWidth, animateViewHeight, wf.speed, slotIndex);
        });
}

function muteAll(){gains.forEach(g => {g.gain.value = 0})};

function replaceAudioSlotWithFile(file, slotIndex) {
    animateAudioData(Promise.resolve(file), slotIndex).then(() => {

        //todo - double check that this doesn't have wierd latencies
        audioElements[slotIndex].src = URL.createObjectURL(file);
        audioElements[slotIndex].oncanplaythrough = () => {
            // audioElements.forEach(a => {a.currentTime = 0});
            console.log("play thru", slotIndex);
            audioElements[slotIndex].play().then(() => {
                audioElements[slotIndex].oncanplaythrough = null; //prevent infinite loop - setting current time trigers 'canplaythrough' event
                delays[slotIndex].delayTime.value = getVisualSyncDelay(slotIndex);
                audioElements.forEach(a => {a.currentTime = 0});
            });
        }
    });
}

let globalGain = new Tone.Gain(1);

function createTonePlayer(wf, slotIndex) {
    let player = new Tone.Player();
    player.loop = true;
    let playerPromise = player.load(wf.url);

    // Update loading progress
    playerPromise.then(updateLoadingAnimation);

    players.push(player);
    playerPromises.push(playerPromise);

    const compressor = new Tone.Compressor(-10, 12);
    compressor.knee.value = 40;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    const delay = new Tone.Delay(0, 20);
    const gain = new Tone.Gain(audioData[slotIndex].volume);

    delays.push(delay);
    gains.push(gain);

    player.chain(gain,delay, compressor, globalGain, Tone.Destination);

    return playerPromise
}

let hoverInfo = document.getElementById('composer-hover');
let infoShowingForBg = null;
hoverInfo.onclick = () => {
    hoverInfo.classList.add('hide');
    infoShowingForBg = null;
}
document.onclick = () => {
    if(infoShowingForBg != null) {
        hoverInfo.classList.add('hide');
        infoShowingForBg = null;
    }
}

let bgInfoClick = (e) => {
    let ind = parseInt(e.target.id.split("-")[1]);
    if(ind === infoShowingForBg){
        hoverInfo.classList.add('hide');
        infoShowingForBg = null;
    } else {
        bgRect = document.getElementById('bgRect-'+ind);
        let hoverImg = document.getElementById('composer-hover-img');
        let hoverText = document.getElementById('composer-hover-text');

        let audio_composer = allComposers.filter(c => c.composerID == audioData[ind].composerID)[0];
        let audio_time = new Date(audioData[ind].uploadedAt).toLocaleString();
        
        hoverImg.src = audio_composer.photo;
        hoverText.innerText = `Uploaded by ${audio_composer.name} \non ${audio_time}`;

        let {top, left} = bgRect.getBoundingClientRect();
        console.log("composer hover val", top, left, Date.now());
        hoverInfo.style.top = top+'px';
        hoverInfo.style.left = left+'px';
        console.log("composer hover style", hoverInfo.style.top, hoverInfo.style.left);
        hoverInfo.classList.remove('hide');
        infoShowingForBg = ind;
    }
    e.stopPropagation();
}

function drawWaveformBackground(wf, group, i) {
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const view_height = wf.viewHeight * (wf.mirrored ? 2 : 1);
    bgRect.setAttribute("x", 0);
    bgRect.setAttribute("y", 0);
    bgRect.setAttribute("height", view_height);
    bgRect.setAttribute("width", wf.viewWidth);
    bgRect.setAttribute("fill", TRANSPARENT_COLOR);
    bgRect.setAttribute("stroke", 'white');
    bgRect.setAttribute('stroke-width', '0px');
    bgRect.setAttribute('id', 'bgRect-' + i);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.style.visibility = "hidden";
    label.textContent = "" + i;
    label.setAttribute("x", wf.viewWidth/2);
    label.setAttribute("y", view_height/2);
    label.setAttribute("fill", "red");

    group.appendChild(label);
    group.appendChild(bgRect);

    group.onclick = bgInfoClick;

    // bgRect.onmouseenter = () => { 
    //     showInfo();
    // };
    // bgRect.onmouseleave = () => {
    //     hoverInfo.classList.add('hide');
    // }
}

function fadeInAnimation(index) {
    // Define fade in animation
    let fadeInAnimation = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "animate"
    );
    fadeInAnimation.setAttribute("class", `fadeIn-${index}`);
    fadeInAnimation.setAttribute("attributeName", "opacity");
    fadeInAnimation.setAttribute("dur", "4s");
    fadeInAnimation.setAttribute("values", "0;0.1;0.2;1");
    fadeInAnimation.setAttribute("times", "0;0.4;0.8;1");
    fadeInAnimation.setAttribute("repeatCount", "1");
    fadeInAnimation.setAttribute("begin", "indefinite");
    return fadeInAnimation;
}

function drawZeroLine(wf, group) {
    // Draw line at zero to make the no-waveform part look better.
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", 0);
    line.setAttribute("x2", wf.viewWidth);
    line.setAttribute("y1", wf.viewHeight);
    line.setAttribute("y2", wf.viewHeight);
    line.setAttribute("stroke", WAVEFORM_COLOR);
    line.appendChild(fadeInAnimation(wf.index));
    group.appendChild(line);
}

function visualize(audioBuffer, waveformHeight, slotIndex) {
    //- console.log("visializing", slotIndex);
    //- if(slotIndex == 2) debugger;
    let visDataLogging = {};
    const duration = audioBuffer.duration;
    const rawData = audioBuffer.getChannelData(0); // We only need to work with one channel of data
    const samples = SAMPLES_PER_SECOND * duration;
    const blockSize = Math.max(Math.floor(rawData.length / samples), 1); // Number of samples in each subdivision
    let lastSamp = 0;
    let data = [];
    for (let i = 0; i < samples; i++) {
        let blockStart = blockSize * i; // the location of the first sample in the block
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
            sum = sum + Math.abs(rawData[blockStart + j]); // find the sum of all the samples in the block
            lastSamp = blockStart + j;
        }
        data.push(sum / blockSize); // divide the sum by the block size to get the average
    }

    visDataLogging.rawDataLen = rawData.length;
    visDataLogging.lastSamp = lastSamp;
    visDataLogging.samples = samples;
    visDataLogging.blockSize = blockSize;
    visDataLogging.missingSec = (rawData.length - lastSamp) /audioCtx.sampleRate;
    console.log("visData", slotIndex, visDataLogging);
    

    // Normalize peaks in data so that the max peak is always 1.
    //- if(slotIndex == 2) debugger;
    data = data.filter(n => !isNaN(n)); //todo - might need to make this more rigorous
    if (NORMALIZE_DATA) {
        data = normalizeData(data);
    }
    //waveformHeight = waveformHeight / 2;
    // Create all of the points for our svg.
    
    // +2 for beginning and ending at 0 height.
    const width = (data.length + 2) * pixelsPerSample;
    const points = [];
    points.push([0, waveformHeight]); // begin at 0
    let x = 0;
    for (let height of data) {
        const y = waveformHeight - height * waveformHeight;
        x += pixelsPerSample;
        points.push([x, y]);
    }

    let baseLength = points.length;
    let baseWaveArc = points.map(a => a);
    let flipFunc = y => waveformHeight * 2 - y;

    for (let i = points.length - 1; i >= 0; i--) {
        const [x, y] = points[i];
        points.push([x, waveformHeight * 2 - y]);
    }

    let oldWave = document.getElementById('wave-' + slotIndex);
    let group = document.getElementById('group-' + slotIndex);
    if (oldWave) {
        group.removeChild(oldWave);
    }

    // Create the svg container for the waveform.
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("height", waveformHeight * 2);
    svg.setAttribute("width", width);
    svg.setAttribute("id", "wave-" + slotIndex);
    svg.setAttribute("preserveAspectRatio", "none");

    // Create the actual polyline.
    const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline"
    );
    line.setAttribute("fill", WAVEFORM_COLOR);
    line.setAttribute("stroke", "none");
    const pointsJoined = points
        .map(([x, y]) => {
            return `${x},${y}`;
        })
        .join(" ");
    line.setAttribute("points", pointsJoined);
    line.setAttribute("id", "waveline-"+slotIndex);
    // Add fade in animation
    line.appendChild(fadeInAnimation(slotIndex));
    svg.appendChild(line);

    waveforms[slotIndex].width = width;

    let repeatedWaveBuffer = [];
    let topWaveBuffer = [];

    let wf = waveforms[slotIndex];
    // if(width < wf.viewWidth * MAX_ZOOM_OUT){
        //todo - clean this up and to only copy over end-part of wave when file is large 
        let numRepeats = Math.max(Math.floor(wf.viewWidth * MAX_ZOOM_OUT / width), 2); 
        let waveCopyStrings = [];
        for(let i = 0; i < numRepeats; i++){
            let repeat = points.map(([x, y]) => `${x-(i+1)*width},${y}`).join(" "); //copy of the waveform shifted i wavelengths
            repeatedWaveBuffer.push(points.map(([x, y]) => [x-(i+1)*width, y]));
            topWaveBuffer.push(baseWaveArc.map(([x, y]) => [x+(i+1)*width, y]))
            waveCopyStrings.push(repeat);
        }
        drawPointBuffers[slotIndex] = {baseLength, points: repeatedWaveBuffer.flat(1), flipFunc, baseWaveArc, width, waveTop: topWaveBuffer.flat(1)};
        
        let workerPointBuf = Object.assign({}, drawPointBuffers[slotIndex]);
        workerPointBuf.flipFunc = 'removed'; //cant serialize functions
        workerPointBuf.waveformHeight = waveformHeight;
        waveWorker.postMessage(['drawPointBuffers', slotIndex, workerPointBuf]);
        
        line.setAttribute("points", pointsJoined + " " + waveCopyStrings.join(" "));
    // } else {
    //     let endSlice = getWaveEndSlice(points, wf.viewWidth * MAX_ZOOM_OUT);
    //     let endSliceString = endSlice.map(([x, y]) => `${x-width},${y}`).join(" ");
    //     line.setAttribute("points", pointsJoined + " " + endSliceString);
    // }

    return { waveformWidth: width, svg };
}

// function getWaveEndSlice(points, endSize){
//     let ind = points.length-1;
//     let xEnd = points.slice(-1)[0][0];
//     while(xEnd - points[ind][0] < endSize) ind--;
//     return points.slice(ind);
// }

function normalizeData(filteredData) {
    const multiplier = Math.pow(Math.max(...filteredData), -1);
    return filteredData.map(n => n * multiplier);
}

function getVisualSyncDelay(slotIndex) {
    let wf = waveforms[slotIndex];
    let p = players[slotIndex];
    let audioDur = p.buffer.length * p.sampleTime;
    let lineFrac = wf.linePercent; 
    return (wf.viewWidth * wf.waveZoom)/(wf.width+wf.viewWidth * wf.waveZoom*0) * audioDur * lineFrac;
}

let playerDur = i => players[i].buffer.length * players[i].sampleTime;

let DEBUG_WAVE = -1;
function setUpForDebug(){
    muteAll();
    gains[DEBUG_WAVE].gain.value = 1;
    delays[DEBUG_WAVE].delayTime.value = 0;
}


let waveInfo = [];


function calculateWavePoints(slotIndex, viewWidth, waveProg) {
    let waveZoom = waveforms[slotIndex].waveZoom;
    let zoomedViewWidth = viewWidth*waveZoom; 

    let waveWidth = waveforms[slotIndex].viewWidth;
    let waveSampNum = Math.floor(waveWidth/pixelsPerSample);
    let zoomSampNum = waveSampNum * waveZoom;
    let {baseWaveArc, flipFunc, width, baseLength, waveTop} = drawPointBuffers[slotIndex];
    let startInd = Math.floor(waveProg * baseLength + (baseLength - zoomSampNum));
    let endInd = startInd + zoomSampNum;
    if(waveTop.length <= startInd || waveTop.length <= endInd) {
        let aaaa = 5;
    }
    let xStart = waveTop[startInd][0];
    let topSlice = waveTop.slice(startInd, endInd);
    let sliceWidth = topSlice.slice(-1)[0][0] - xStart;
    let zoomedTopSlice = topSlice.map(([x, y]) => [(x-xStart)/sliceWidth * waveWidth, y]);
    zoomedTopSlice.splice(0, 0, [0, 0]);
    zoomedTopSlice.push([waveWidth, 0]);
    let backwards = zoomedTopSlice.map(([x, y]) => [x, flipFunc(y)]).reverse();
    let newPoints = zoomedTopSlice.concat(backwards);
    let topLen = zoomedTopSlice.length;
    for(let i = 0; i < topLen; i++){

    }

    waveInfo[slotIndex] = {
        width: zoomedTopSlice.slice(-1)[0][0] - zoomedTopSlice[0][0],
        waveProg
    };
    

    if(slotIndex == DEBUG_WAVE) {
        console.log("audioProg", audioProg.toFixed(3), startInd, endInd, xStart, zoomedTopSlice.length, waveforms[slotIndex].linePercent);
    }

    return newPoints;
}


let pointStrings = [0, 1, 2, 3, 4, 5, 6].map(i => '0,0');
let framePoints = [0, 1, 2, 3, 4, 5, 6].map(i => [[0, 0]]);
waveWorker.onmessage = function(e){
    if(e.data[0] === 'ptString'){
        pointStrings[e.data[1]] = e.data[2];
    }
    if(e.data[0] === 'framePoints'){
        framePoints[e.data[1]] = e.data[2];
    }
}

let perWaveDrawCalls = [];
let hasLineRedrawFlag = (new URLSearchParams(document.location.search).get('USE_LINE_REDRAW')) === 'true';
let USE_LINE_REDRAW = isMobile || hasLineRedrawFlag;
let USE_WORKER = USE_LINE_REDRAW;
function animate(svg, waveformWidth, viewWidth, viewHeight, speed, slotIndex) {
    let waveZoom = waveforms[slotIndex].waveZoom;
    let offset = -1 * viewWidth;
    svg.setAttribute("width", viewWidth.toString());
    if(!USE_LINE_REDRAW) svg.setAttribute("viewBox", `${offset} 0 ${viewWidth*waveZoom} ${viewHeight}`);
    let polyline = document.getElementById('waveline-'+slotIndex);
    let frameCount = 0;
    let lastPointString = '0,0';
    function draw(ts) {
        // requestAnimationFrame(draw);

        let dur = playerDur(slotIndex);
        let audioProg = ( ( (Tone.Transport.now()-transportStartTime) + loopOffsets[slotIndex] ) % dur)/dur;

        let fakeAudioProg = (Date.now()/1000 % dur)/dur;
        let waveProg = isPlaying ? audioProg : fakeAudioProg;

        if(USE_WORKER && USE_LINE_REDRAW) waveWorker.postMessage(['getString', slotIndex, viewWidth, waveProg, pixelsPerSample]);
        // if(kgl) return;
        if(controllerProps.manualProg) waveProg = controllerProps['prog'+slotIndex] % .999;

        let waveZoom = waveforms[slotIndex].waveZoom;
        let zoomedViewWidth = viewWidth*waveZoom; 
        offset = waveProg * (waveformWidth + zoomedViewWidth*0) - zoomedViewWidth;

        if(!isNaN(offset)) {
            
            if(kgl){//if a konva layer exists render with konva instead
                kgLines[slotIndex].setPoints(framePoints[slotIndex].flat());
            } else {
                // let pointString = newPoints.map(([x, y]) => `${x},${y}`).join(" ");
                // let pointString = newPoints.flat()
                let wavePtString = USE_WORKER ? pointStrings[slotIndex] : lastPointString;
                if(USE_LINE_REDRAW) polyline.setAttribute('points', wavePtString);
                else svg.setAttribute("viewBox", `${offset} 0 ${zoomedViewWidth} ${viewHeight}`);
                if(!USE_WORKER && USE_LINE_REDRAW) {
                    setTimeout(() => {
                        let newPoints = calculateWavePoints(slotIndex, viewWidth, waveProg);
                        lastPointString = newPoints.map(([x, y]) => `${x},${y}`).join(" ");
                    }, 5);
                }
            }
        }
        // meter.tick();
    }
    perWaveDrawCalls.push(draw);
    // requestAnimationFrame(draw);
}

let kgl = null;
let meter = new FPSMeter();
function konvaDrawLoop(){
    requestAnimationFrame(konvaDrawLoop);
    meter.tick();
    // console.log("draws", waveDraws.length);
    perWaveDrawCalls.forEach(d => d());
    if(kgl){
        kgl.clear();
        kgl.draw();
    }
}

konvaDrawLoop();

function pauseAll(){
    audioElements.forEach(a => a.pause());
    audioElements.forEach(a => {a.currentTime = 0});
}

function addExitFullScreenButton(container){
    const button = document.createElementNS("http://www.w3.org/2000/svg", "image");
    button.id = 'exit-fullscreen';
    const buttonSize = 15;
    button.setAttribute('href', './images/exit-fullscreen.png');
    button.setAttribute('width', buttonSize);
    button.setAttribute('height', buttonSize);
    button.setAttribute('x', CONTAINER_WIDTH-buttonSize-10);
    button.setAttribute('y', CONTAINER_HEIGHT-buttonSize-10);
    button.style.visibility = 'hidden';

    button.onclick =() => {
        document.exitFullscreen().then(() => exitFullScreen());
    }

    container.append(button);
    let mouseMoveTimeout = null;
    container.addEventListener('mousemove', e => {
        if(!isFullScreen) return;
        if(mouseMoveTimeout) clearTimeout(mouseMoveTimeout);
        button.style.visibility = '';
        mouseMoveTimeout = setTimeout(() => {
            button.style.visibility = 'hidden';
        }, 2000)
    });
}

const container = document.createElementNS("http://www.w3.org/2000/svg", "svg");

function begin() {
    // document.getElementById('beginButton').classList.add('hide');
    // document.getElementById('fullscreen').classList.remove('hide');
    // document.getElementById('playAudio').classList.remove('hide');
    // let vol_stuff = document.getElementsByClassName('global_vol');
    // vol_stuff[0].classList.remove("hide")
    // vol_stuff[1].classList.remove("hide")

    if (isMobile) {
        // Set to max volume and hide volume control on mobile
        changeVol(2.0);
    } else {
        // Show volume control on desktop
        document.getElementById('volume-widget').classList.remove('hide');
        createVolumeWidget("volume-widget", (val) => changeVol(2.0 * val), { startBar: 1 });
    }

    audioCtx.resume().then(() => {
        console.log('Playback resumed successfully');
    });

    //document.addEventListener("DOMContentLoaded", function() {
    if (DEBUG) {
        container.setAttribute("style", "border: 1px solid black;"); // just for visualization
    }
    container.setAttribute("width", "100%");
    container.setAttribute("viewBox", `0 0 ${CONTAINER_WIDTH} ${CONTAINER_HEIGHT}`);
    document.getElementById("installation").append(container);
    // container.style.visibility = 'hidden';
    container.id = 'installation-svg';
    container.setAttribute("preserveAspectRatio", "none");

    // Create blur filter
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    container.appendChild(defs);
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.id = 'blurFilter';
    filter.setAttribute('x', '0%');
    filter.setAttribute('y', '0%');
    defs.appendChild(filter);
    installationBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    installationBlur.setAttribute('in', 'SourceGraphic');
    installationBlur.setAttribute('stdDeviation', '0'); // Start with no blur
    filter.appendChild(installationBlur);

    // Set blur on container
    container.setAttribute('filter', "url('#blurFilter')");

    container.appendChild(createZigZag());
    startLoadingAnimation();
    waveforms.forEach((wf, i) => {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", wf.transform);
        group.setAttribute("id", "group-" + i);

        drawWaveformBackground(wf, group, i);

        if (wf.zIndex < 0) {
            container.prepend(group);
        } else {
            container.appendChild(group);
        }

        createTonePlayer(wf, i);
    });

    // Wait until all the audio is downloaded to start drawing the waveforms,
    //  which is much faster
    Promise.all(playerPromises).then(() => {
        playerPromises.forEach((playerPromise, i) => {
            playerPromise.then(tonePlayer => {
                // Start drawing the waveforms and animating
                drawPromises.push(animateAudioData(tonePlayer.buffer, i));
            });
        });
    });

    let loadRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    loadRect.setAttribute("y", 0);
    loadRect.setAttribute("y", 0);
    loadRect.setAttribute("height", CONTAINER_HEIGHT);
    loadRect.setAttribute("width", CONTAINER_WIDTH);
    loadRect.setAttribute("fill", ZIGZAG_COLOR);
    // container.appendChild(loadRect);

    // NOTE: drawPromises ([animateAudioData]) are all immediately resolved due
    //  to animateAudioData returning Promise.resolve(), so need to wait

    // Promise.all(drawPromises).then(() => {
    //     // container.removeChild(loadRect);
    //     container.style.visibility = 'visible';
    // });

    // Promise.all([audioElementPromises, drawPromises].flat()).then(() => {
    //     console.log("ready to play");
    //     audioElements.map((a, i) => {
    //         a.play();
    //         delays[i].delayTime.value = getVisualSyncDelay(i);
    //     });
    // });

    addExitFullScreenButton(container);
}

let kg = []; //konva groups
let kgLines = [];
function drawKonva() {
    // first we need to create a stage
  var stage = new Konva.Stage({
    container: 'konvatest',   // id of container <div>
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT
  });
  
  // then create layer
  var layer = new Konva.Layer();
  kgl = layer;
  
  // add the layer to the stage
  stage.add(layer);

  [0, 1, 2, 3, 4, 5, 6].forEach(i => {
    let group = new Konva.Group();
    kg.push(group);
    let svgGroup = document.getElementById("group-"+i);
    let mv = svgGroup.transform.baseVal.consolidate().matrix;
    let {a, b, c, d, e, f} = mv;
    let matrixArrray = [a, b, c, d, e, f];
    let xTrans = e;
    let yTrans = f;
    let theta = Math.atan2(c, d);
    let transform = new Konva.Transform(matrixArrray);
    let decomp = transform.decompose();

    let svgRect = document.getElementById("bgRect-"+i);
    let rect = new Konva.Rect({
        width: svgRect.width.baseVal.value,
        height: svgRect.height.baseVal.value,
        fill: 'red',
        stroke: 'black',
        strokeWidth: 5
    });
    rect.fillRadialGradientColorStops(0, 'red', 0.5, 'blue', 1, 'green');

    var poly = new Konva.Line({
        points: [23, 20, 23, 160, 70, 93, 150, 109, 290, 139, 270, 93],
        fill: '#00D2FF',
        stroke: 'black',
        strokeWidth: 0.5,
        closed: true,
      });

    kdraw(i, decomp.x, decomp.y, decomp.rotation);

    // group.rotation(theta * 180 / Math.PI);
    // group.setOffsetX(xTrans);
    // group.setOffsetY(yTrans);

    // group.rotation(decomp.rotation);
    // group.setOffsetX(decomp.x);
    // group.setOffsetY(decomp.y);

    group.add(poly);
    kgLines.push(poly);
    // group.add(rect);
    layer.add(group);
  });
  
  // draw the image
  layer.draw();
}

function kdraw(i, x, y, rot){
    kg[i].setX(x);
    kg[i].setY(y);
    kg[i].rotation(rot);
    console.log("konv", i, x, y, rot);
    kgl.clear();
    kgl.draw();
}

function kvfull(){
    document.getElementsByTagName('canvas')[0].requestFullscreen();
}

let ANIMATE_BACKGROUND = (new URLSearchParams(document.location.search).get('ANIMATE_BACKGROUND')) === 'true';
let backgroundStyle = ANIMATE_BACKGROUND ? 'animated-background' : 'static-background';

let bodyElem = document.getElementsByClassName('css-selector')[0];
bodyElem.classList.remove('css-selector');
bodyElem.classList.add(backgroundStyle);

let isFullScreen = false;
function goFullScreen() {
    const elem = document.getElementById('installation');
    const svgElem = document.getElementById('installation-svg');
    const exitFullScreenBuffon = document.getElementById('exit-fullscreen');
    // exitFullScreenBuffon.style.visibility = 'visible';

    if (elem.requestFullscreen) {
        elem.requestFullscreen();
        elem.classList.add(backgroundStyle);
        svgElem.classList.add('isFullscreen');
        isFullScreen = true;
    }
    else if (elem.mozRequestFullScreen) {
        svgElem.mozRequestFullScreen();
        svgElem.classList.add(backgroundStyle);
        svgElem.classList.add('isFullscreen');
        isFullScreen = true;
    }
    else if (elem.webkitRequestFullscreen) {
        svgElem.style.position = 'absolute';
        svgElem.webkitRequestFullscreen();
        svgElem.classList.add(backgroundStyle);
        svgElem.classList.add('isFullscreen');
        isFullScreen = true;
    }
    else if (elem.msRequestFullscreen) {
        svgElem.msRequestFullscreen();
        svgElem.classList.add(backgroundStyle);
        svgElem.classList.add('isFullscreen');
        isFullScreen = true;
    }
}


function exitFullScreen() {
    console.log("exiting fullscreen")
    const elem = document.getElementById('installation');
    const svgElem = document.getElementById('installation-svg');
    const exitFullScreenBuffon = document.getElementById('exit-fullscreen');

    if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
        isFullScreen = false;
        svgElem.classList.remove(backgroundStyle);
        elem.classList.remove(backgroundStyle);
        svgElem.classList.remove('isFullscreen');
        svgElem.style.position = '';
        exitFullScreenBuffon.style.visibility = 'hidden';
    }
}

document.addEventListener('fullscreenchange', exitFullScreen);
document.addEventListener('webkitfullscreenchange', exitFullScreen);
document.addEventListener('mozfullscreenchange', exitFullScreen);
document.addEventListener('MSFullscreenChange', exitFullScreen);

begin();

document.getElementById('time_slider_container').remove(); //todo - temporary 



