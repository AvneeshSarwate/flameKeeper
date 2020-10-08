const AudioContext = window.AudioContext || window.webkitAudioContext
const audioCtx = new AudioContext();

var gui = new dat.GUI();
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

// [0, 1, 2, 3, 4, 5, 6].forEach(i => {
//     gui.add(controllerProps, 'zoom'+i, 0, MAX_ZOOM_OUT, 0.01).onFinishChange(v => {
//         waveforms[i].waveZoom = v;
//         delays[i].delayTime.value = getVisualSyncDelay(i);
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

[0, 1, 2, 3, 4, 5, 6].forEach(i => {
    gui.add(controllerProps, 'prog'+i, 0, 3, 0.01)
});
gui.add(controllerProps, 'manualProg')




document.getElementById('text_slider_display').innerHTML = new Date().toLocaleString();
document.getElementById('time_slider').addEventListener('input', changeTime);
document.getElementById('jump_to_history').addEventListener('click', jumpToHistory);
document.getElementById('global_vol').addEventListener('input', changeVol);


let urlHistory = new URLSearchParams(document.location.search).get('history');
if(urlHistory){
    document.getElementById('time-header').innerText = 
        'The Curator At ' + new Date(parseInt(timestamp)).toLocaleString();    
    let timeProg = (timestamp - firstTimestamp) / (Date.now() - firstTimestamp);
    document.getElementById('time_slider').value = timeProg;
}

// document.getElementById('beginButton').addEventListener('click', begin);
document.getElementById('fullscreen').addEventListener('click', goFullScreen);
document.getElementById('playAudio').addEventListener('click', playAudio);

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

function changeVol(e) {
    let vol = parseFloat(e.target.value);
    globalGain.gain.value = vol;
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
const ZIGZAG_LOADING_EXPONENTIAL = 0.005;
const SAMPLES_PER_SECOND = 120;
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


function setGradient(speed, angle, colors, zooms){
    let speedString = speed+'s';
    let gradientString = `linear-gradient(${angle}deg, ${colors.join(', ')})`;
    let zoomString = zooms.join(" ");

    document.documentElement.style.setProperty('--gradient-speed', speedString);
    document.documentElement.style.setProperty('--gradient-def', gradientString);
    document.documentElement.style.setProperty('--background-size', zoomString);
    // console.log("css", speed, angle, colors);
}

function refreshGradient() {
    fetch('/gradient').then(resp => {
        resp.json().then(gradient => {
            let speed = parseInt(gradient.speed);
            let angle = parseInt(gradient.angle);
            let colors = gradient.colors.split(/(\s+)/).filter(c => c[0] === "#");
            let zooms = gradient.zooms.split(/(\s+)/);
            setGradient(speed, angle, colors, zooms);
        })
    })
}

setTimeout(() => {
    setInterval(() => {
        // refreshGradient();
        
    }, 2 * 1000);
}, 1000 * 2);


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

function drawZeroLine(wf, group) {
    // Draw line at zero to make the no-waveform part look better.
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", 0);
    line.setAttribute("x2", wf.viewWidth);
    line.setAttribute("y1", wf.viewHeight);
    line.setAttribute("y2", wf.viewHeight);
    line.setAttribute("stroke", WAVEFORM_COLOR);
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
    svg.appendChild(line);

    waveforms[slotIndex].width = width;

    let repeatedWaveBuffer = [];
    let topWaveBuffer = [];

    let wf = waveforms[slotIndex];
    // if(width < wf.viewWidth * MAX_ZOOM_OUT){
        //todo - clean this up and to only copy over end-part of wave when file is large 
        let numRepeats = Math.max(Math.floor(wf.viewWidth * MAX_ZOOM_OUT / width), 1); 
        let waveCopyStrings = [];
        for(let i = 0; i < numRepeats; i++){
            let repeat = points.map(([x, y]) => `${x-(i+1)*width},${y}`).join(" "); //copy of the waveform shifted i wavelengths
            repeatedWaveBuffer.push(points.map(([x, y]) => [x-(i+1)*width, y]));
            topWaveBuffer.push(baseWaveArc.map(([x, y]) => [x-(i+1)*width, y]))
            waveCopyStrings.push(repeat);
        }
        drawPointBuffers[slotIndex] = {baseLength, points: repeatedWaveBuffer.flat(1), flipFunc, baseWaveArc, width, waveTop: topWaveBuffer.flat(1)};
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
    DEBUG_WAVE = -1;
    muteAll();
    gains[0].gain.value = 1;
    delays[0].delayTime.value = 0;
}


let USE_LINE_REDRAW = true;


let waveInfo = [];

function animate(svg, waveformWidth, viewWidth, viewHeight, speed, slotIndex) {
    let waveZoom = waveforms[slotIndex].waveZoom;
    let offset = -1 * viewWidth;
    svg.setAttribute("width", viewWidth.toString());
    if(!USE_LINE_REDRAW) svg.setAttribute("viewBox", `${offset} 0 ${viewWidth*waveZoom} ${viewHeight}`);
    let polyline = document.getElementById('waveline-'+slotIndex);
    let frameCount = 0;
    function draw(ts) {
        frameCount++;
        let waveZoom = waveforms[slotIndex].waveZoom;
        let zoomedViewWidth = viewWidth*waveZoom;

        let dur = playerDur(slotIndex);
        let audioProg = ( ( (Tone.Transport.now()-transportStartTime) + loopOffsets[slotIndex] ) % dur)/dur; 

        if (!svg.parentElement) return; //if this wave has been removed, don't requeue animation for it

        let fakeAudioProg = (Date.now()/1000 % dur)/dur;
        let waveProg = isPlaying ? audioProg : fakeAudioProg;

        if(controllerProps.manualProg) waveProg = controllerProps['prog'+slotIndex] % .999;

        offset = waveProg * (waveformWidth + zoomedViewWidth*0) - zoomedViewWidth;
        let nearFrac = Math.abs(.9 - (audioProg/waveforms[slotIndex].linePercent)) < 0.05

        // let waveWidth = waveforms[slotIndex].viewWidth;
        // let waveStart = Math.floor(drawPointBuffers[slotIndex].baseLength * waveProg);
        // let waveSampNum = Math.floor(waveWidth/pixelsPerSample);
        // let pointSlice = drawPointBuffers[slotIndex].points.slice(waveStart, waveStart + waveSampNum);
        // let interpolation = 0;// todo - can interpolate points to adjust for rounding the waveStart/end
        // if(!pointSlice || !pointSlice[0]) debugger;
        // let startX = pointSlice[0][0];
        // let newPoints = pointSlice.map(([x, y]) => [x-startX+interpolation, y]);

        let waveWidth = waveforms[slotIndex].viewWidth;
        let waveSampNum = Math.floor(waveWidth/pixelsPerSample);
        let {baseWaveArc, flipFunc, width, baseLength, waveTop} = drawPointBuffers[slotIndex];
        let startInd = Math.floor(waveProg * baseLength);
        let endInd = startInd + waveSampNum;
        let xStart = waveTop[startInd][0];
        let topSlice = waveTop.slice(startInd, endInd).map(([x, y]) => [x-xStart, y]);
        let backwards = topSlice.map(([x, y]) => [x, flipFunc(y)]).reverse();
        let newPoints = topSlice.concat(backwards);

        waveInfo[slotIndex] = {
            width: topSlice.slice(-1)[0][0] - topSlice[0][0],
            waveProg
        };
        

        if(nearFrac && slotIndex == DEBUG_WAVE) console.log("audioProg", audioProg, waveforms[slotIndex].linePercent);

        if(!isNaN(offset)) {
            let pointString = newPoints.map(([x, y]) => `${x},${y}`).join(" ");
            if(USE_LINE_REDRAW) polyline.setAttribute('points', pointString)
            else svg.setAttribute("viewBox", `${offset} 0 ${zoomedViewWidth} ${viewHeight}`);
        }
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
}

function pauseAll(){
    audioElements.forEach(a => a.pause());
    audioElements.forEach(a => {a.currentTime = 0});
}

function begin() {
    // document.getElementById('beginButton').classList.add('hide');
    // document.getElementById('fullscreen').classList.remove('hide');
    // document.getElementById('playAudio').classList.remove('hide');
    // let vol_stuff = document.getElementsByClassName('global_vol');
    // vol_stuff[0].classList.remove("hide")
    // vol_stuff[1].classList.remove("hide")


    audioCtx.resume().then(() => {
        console.log('Playback resumed successfully');
    });

    //document.addEventListener("DOMContentLoaded", function() {
    const container = document.createElementNS("http://www.w3.org/2000/svg", "svg");
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

        drawZeroLine(wf, group);

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
}


function goFullScreen() {
    const elem = document.getElementById('installation');
    const svgElem = document.getElementById('installation-svg');

    if (elem.requestFullscreen) {
        elem.requestFullscreen();
        elem.classList.add('css-selector');
        svgElem.classList.add('isFullscreen');
    }
    else if (elem.mozRequestFullScreen) {
        svgElem.mozRequestFullScreen();
        svgElem.classList.add('css-selector');
        svgElem.classList.add('isFullscreen');
    }
    else if (elem.webkitRequestFullscreen) {
        svgElem.style.position = 'absolute';
        svgElem.webkitRequestFullscreen();
        svgElem.classList.add('css-selector');
        svgElem.classList.add('isFullscreen');
    }
    else if (elem.msRequestFullscreen) {
        svgElem.msRequestFullscreen();
        svgElem.classList.add('css-selector');
        svgElem.classList.add('isFullscreen');
    }
}


function exitFullScreen() {
    const elem = document.getElementById('installation');
    const svgElem = document.getElementById('installation-svg');

    if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
        svgElem.classList.remove('css-selector');
        elem.classList.remove('css-selector');
        svgElem.classList.remove('isFullscreen');
        svgElem.style.position = '';
    }
}

document.addEventListener('fullscreenchange', exitFullScreen);
document.addEventListener('webkitfullscreenchange', exitFullScreen);
document.addEventListener('mozfullscreenchange', exitFullScreen);
document.addEventListener('MSFullscreenChange', exitFullScreen);

begin();

document.getElementById('time_slider_container').remove(); //todo - temporary 



