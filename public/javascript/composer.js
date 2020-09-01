const AudioContext = window.AudioContext || window.webkitAudioContext
const audioCtx = new AudioContext();

if (isComposer) {
    document.getElementById('jump_time_button').addEventListener('click', jumpToTime);
    document.getElementById('undo_button').addEventListener('click', undoReplace);
    document.getElementById('vol').addEventListener('input', changeVol);
    document.getElementById('replace_file_input').addEventListener('change', replaceFile);
} else {
    document.getElementById('text_slider_display').innerHTML = new Date().toLocaleString();
    document.getElementById('time_slider').addEventListener('input', changeTime);
    document.getElementById('jump_to_history').addEventListener('click', jumpToHistory);
}

document.getElementById('beginButton').addEventListener('click', begin);
document.getElementById('fullscreen').addEventListener('click', goFullScreen);

let selected_waveform = null;
let audioElements = [];
let audioElementPromises = [];
let waveformGroups = [];
let gains = [];
let delays = [];
let file_is_replaced = false;
let lastVolume = null; //the previos volume of the slot was replaced. saved for undo in single-replace mode
let submissionData = {};

function undoReplace() {
    document.getElementById('undo_button').classList.add('hide');
    document.getElementById('vol_span').classList.add('hide');
    document.getElementById('replace_file_span').classList.remove('hide');

    
    animateAudioData(fetch(waveforms[selected_waveform].url), selected_waveform);
    audioElements[selected_waveform].src = waveforms[selected_waveform].url;

    audioElements.forEach(ae => { ae.currentTime = 0 });
    const undoWave = selected_waveform;
    audioElements[undoWave].oncanplaythrough = () => {
        audioElements[undoWave].play().then(() => {
            audioElements[undoWave].oncanplaythrough = null; //prevent infinite loop - setting current time trigers 'canplaythrough' event
            audioElements.forEach(a => {a.currentTime = 0});
        });
    }
    resetGains();

    file_is_replaced = false;
    selected_waveform = null;
    toggleGroupBorders();

    document.getElementById('replace_file_input').value = '';

    submissionData = {};
}

function submit() {
    let formData = new FromData();
    for (k in submissionData) {
        form.append(k, submissionData[k]);
    }
    fetch('submissionurl', {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
    })
}

function resetGains() {
    gains[selected_waveform].gain.value = lastVolume;
    document.getElementById('vol').value = lastVolume;
}

function jumpToTime() {
    let timeStr = document.getElementById('jump_time').value;
    try {
        let secs = parseFloat(timeStr);
        audioElements.forEach(ae => {
            ae.currentTime = secs % ae.duration;
        })
    } catch {
        alert("only numbers can be in the time box")
    }
}

function replaceFile(e) {
    let selector = e.target;
    let files = e.target.files;
    console.log("file replace", files, selector);
    if (selected_waveform != null) {
        document.getElementById('undo_button').classList.remove('hide');
        document.getElementById('vol_span').classList.remove('hide');
        document.getElementById('replace_file_span').classList.add('hide');

        replaceAudioSlotWithFile(files[0], selected_waveform);
        file_is_replaced = true;
        lastVolume = gains[selected_waveform].gain.value;

        submissionData['file'] = files[0];
        submissionData['index'] = selected_waveform;
        submissionData['volume'] = 1;
    }
    else {
        document.getElementById('replace_file_input').value = '';
        alert("pick a waveform to replace its audio");
    }
}

function submitChanges() {

}

function changeVol(e) {
    let slider = e.target;
    let vol = parseFloat(e.target.value);
    // console.log('change vol', selected_waveform, vol, typeof vol);
    gains[selected_waveform].gain.value = vol;
    document.getElementById('vol_val').innerText = vol;
    submissionData['volume'] = vol;
}

function changeTime(e) {
    let newTimeStamp = (Date.now() - firstEntry) * parseFloat(e.target.value) + firstEntry;
    let newTimeString = new Date(newTimeStamp).toLocaleString();
    document.getElementById('text_slider_display').innerHTML = newTimeString;
}

function jumpToHistory() {
    let sliderVal = parseFloat(document.getElementById('time_slider').value);
    let newTimeStamp = (Date.now() - firstEntry) * sliderVal + firstEntry;
    getInstallationByTimestamp(newTimeStamp);
}

function resetWaveFromURL(filename, gainVal, audioTime, slotIndex){
    let audio = audioElements[slotIndex];
    let url = `https://flamekeeper.s3.amazonaws.com/${filename}`;
    
    gains[slotIndex].gain.value = gainVal;
    audio.src = url;
    animateAudioData(fetch(url), slotIndex);

    let audioPromise = new Promise((resolve) => {
        audio.oncanplaythrough = () => resolve(audio);
    }).then(audio => new Promise((resolve) => {
        audio.currentTime = (audioTime / 1000) % audio.duration; //todo fill in time function
        audio.onseeked = () => resolve(audio);
    }));

    return audioPromise;
}

function getInstallationByTimestamp(timestamp) {
    fetch(document.location.origin + '/getInfo?history=' + timestamp)
        .then(response => response.json())
        .then(jsonData => {
            console.log(jsonData);

            document.getElementById('composer-name').innerText = jsonData.composer.name;
            document.getElementById('composer-bio').innerText = jsonData.composer.bio;
            document.getElementById('composer-photo').src = jsonData.composer.photo;
            document.getElementById('time-header').innerText = 'The Curator At ' + new Date(timestamp).toLocaleString();

            audioData = jsonData.loadedAudio;
            
            let newAudioPromises = audioData.map((ad, i) => resetWaveFromURL(ad.filename, ad.volume, timestamp, i));
            Promise.all(newAudioPromises).then(() => {
                audioElements.forEach(ae => ae.play());
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
const SAMPLES_PER_SECOND = 120;
const PIXELS_PER_SECOND = 50;
const NORMALIZE_DATA = true;
const WAVEFORM_COLOR = "gray";
const HIGHLIGHT_COLOR = "#ff5050aa";
const TRANSPARENT_COLOR = "#ffffff00";

const DEBUG = false;

// Nice convenient way to describe the waveforms.
const waveforms = [
    {//Wave-0
        url: `https://flamekeeper.s3.amazonaws.com/${returns[0]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 290,
        transform: `translate(10 40)`,
        zIndex: -1,
        panAmount: -0.75,
        delay: 2.155, 
        waveZoom: 1,
        linePercent: 1
    },
    {//Wave-1
        url: `https://flamekeeper.s3.amazonaws.com/${returns[1]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 190,
        transform: `translate(180 110) rotate(90)`,
        zIndex: -1,
        panAmount: 0.5,
        delay: 2.48, 
        waveZoom: 1,
        linePercent: 1
    },
    {//Wave-2
        url: `https://flamekeeper.s3.amazonaws.com/${returns[2]}`,
        speed: 15,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 200,
        transform: `translate(400 200) rotate(180)`,
        zIndex: -1,
        panAmount: 0.75,
        delay: 1.53, 
        waveZoom: 1,
        linePercent: 1
    },
    {//Wave-3
        url: `https://flamekeeper.s3.amazonaws.com/${returns[3]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 200,
        transform: `translate(400 260) rotate(180)`,
        zIndex: 1,
        panAmount: 0.25,
        delay: 1.35, 
        waveZoom: 1,
        linePercent: 1
    },
    {//Wave-4
        url: `https://flamekeeper.s3.amazonaws.com/${returns[4]}`,
        speed: 10,
        mirrored: false,
        viewHeight: 30,
        viewWidth: 190,
        transform: `translate(420 300) rotate(270)`,
        zIndex: -1,
        panAmount: 0,
        delay: 2.27, 
        waveZoom: 1,
        linePercent: 1
    },
    {//Wave-5
        url: `https://flamekeeper.s3.amazonaws.com/${returns[5]}`,
        speed: 10,
        mirrored: false,
        viewHeight: 30,
        viewWidth: 190,
        transform: `rotate(90 95 15) translate(190 -370)`,
        zIndex: -1,
        panAmount: -0.25,
        delay: 0.47, 
        waveZoom: 1,
        linePercent: 1
    },
    {//Wave-6
        url: `https://flamekeeper.s3.amazonaws.com/${returns[6]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 120,
        transform: `translate(380 330)`,
        zIndex: -1,
        panAmount: -0.5,
        delay: 0, 
        waveZoom: 1,
        linePercent: 1
    }
];

function createZigZag() {
    const vlength = Math.floor((CONTAINER_HEIGHT - VPAD * 2) / 3);
    const hlength = Math.floor((CONTAINER_WIDTH - HPAD * 2) / 2);
    const points = [
        [HPAD, VPAD],
        [HPAD, VPAD + vlength],
        [HPAD + hlength, VPAD + vlength],
        [HPAD + hlength, VPAD + vlength * 2],
        [HPAD + hlength * 2, VPAD + vlength * 2],
        [HPAD + hlength * 2, VPAD + vlength * 3]
    ]
        .map(([x, y]) => `${x},${y}`)
        .join(" ");
    const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline"
    );
    line.setAttribute("stroke", ZIGZAG_COLOR);
    line.setAttribute("stroke-width", ZIGZAG_WIDTH);
    line.setAttribute("fill", "none");
    line.setAttribute("points", points);
    line.setAttribute("id", "zigzag");
    return line;
}

function animateAudioData(audioDataPromise, slotIndex) {
    let wf = waveforms[slotIndex];
    let group = document.getElementById('group-' + slotIndex);

    audioDataPromise
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
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

function replaceAudioSlotWithFile(file, slotIndex) {
    animateAudioData(Promise.resolve(file), slotIndex)

    //todo - double check that this doesn't have wierd latencies
    audioElements[slotIndex].src = URL.createObjectURL(file);
    audioElements[slotIndex].oncanplaythrough = () => {
        // audioElements.forEach(a => {a.currentTime = 0});
        console.log("play thru", slotIndex);
        audioElements[slotIndex].play().then(() => {
            audioElements[slotIndex].oncanplaythrough = null; //prevent infinite loop - setting current time trigers 'canplaythrough' event
            audioElements.forEach(a => {a.currentTime = 0});
        });
    }
}

function createAudioElement(wf, slotIndex) {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    if (returns.length > 0) audio.src = wf.url;
    audio.loop = true;

    //- setTimeout(function() {
    //-   audio.play();
    //- }, 5000);

    // audio.addEventListener("canplaythrough", () => { audio.play() });

    let audioPromise = new Promise((resolve) => {
        audio.oncanplaythrough = () => resolve(audio);
    }).then(audio => new Promise((resolve) => {
        audio.currentTime = ((Date.now() - timestamp) / 1000) % audio.duration; //todo fill in time function
        audio.onseeked = () => resolve(audio);
    }));

    audioElementPromises.push(audioPromise);

    audioElements.push(audio);

    document.body.appendChild(audio);
    const source = audioCtx.createMediaElementSource(audio);

    //- const panner = new PannerNode(audioCtx);

    const compressor = audioCtx.createDynamicsCompressor();
    const gain = audioCtx.createGain();
    gain.gain.value = audioData[slotIndex].volume;
    gains.push(gain);

    const delay = audioCtx.createDelay(5);
    delay.delayTime.value = waveforms[slotIndex].delay;
    delays.push(delay);
    
    compressor.threshold.setValueAtTime(-10, audioCtx.currentTime);
    compressor.knee.setValueAtTime(40, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.25, audioCtx.currentTime);
    //todo - initialize gain from state data

    //- panner.setPosition(wf.panAmount,0,1-Math.abs(wf.panAmount));
    //- source.connect(panner).connect(compressor).connect(audioCtx.destination);
    source.connect(gain).connect(delay).connect(compressor).connect(audioCtx.destination);
}

function toggleGroupBorders() {
    [0, 1, 2, 3, 4, 5, 6].map(i => {
        const bgRect = document.getElementById('bgRect-' + i);
        bgRect.setAttribute("stroke-width", selected_waveform === i ? '3px' : '0px')
    });
}

function drawWaveformBackground(wf, group, i) {
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", 0);
    bgRect.setAttribute("y", 0);
    bgRect.setAttribute("height", wf.viewHeight * (wf.mirrored ? 2 : 1));
    bgRect.setAttribute("width", wf.viewWidth);
    bgRect.setAttribute("fill", TRANSPARENT_COLOR);
    bgRect.setAttribute("stroke", 'white');
    bgRect.setAttribute('stroke-width', '0px');
    bgRect.setAttribute('id', 'bgRect-' + i);

    group.appendChild(bgRect);

    if (isComposer) {
        group.onclick = () => {
            if (file_is_replaced) {
                alert("Undo your current file-change before replacing a different file");
                return
            }
            selected_waveform = i;
            toggleGroupBorders();
        };

        group.onmouseenter = () => { bgRect.setAttribute("fill", HIGHLIGHT_COLOR) };
        group.onmouseleave = () => { bgRect.setAttribute("fill", TRANSPARENT_COLOR) };
    }
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
    const duration = audioBuffer.duration;
    const rawData = audioBuffer.getChannelData(0); // We only need to work with one channel of data
    const samples = SAMPLES_PER_SECOND * duration;
    const blockSize = Math.max(Math.floor(rawData.length / samples), 1); // Number of samples in each subdivision
    let data = [];
    for (let i = 0; i < samples; i++) {
        let blockStart = blockSize * i; // the location of the first sample in the block
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
            sum = sum + Math.abs(rawData[blockStart + j]); // find the sum of all the samples in the block
        }
        data.push(sum / blockSize); // divide the sum by the block size to get the average
    }

    //TODO: - loop-through data again so that viewport skip-back is seamless

    // Normalize peaks in data so that the max peak is always 1.
    //- if(slotIndex == 2) debugger;
    data = data.filter(n => !isNaN(n)); //todo - might need to make this more rigorous
    if (NORMALIZE_DATA) {
        data = normalizeData(data);
    }
    //waveformHeight = waveformHeight / 2;
    // Create all of the points for our svg.
    const pixelsPerSample = PIXELS_PER_SECOND / SAMPLES_PER_SECOND;
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
    svg.appendChild(line);

    waveforms[slotIndex].width = width;

    return { waveformWidth: width, svg };
}

function normalizeData(filteredData) {
    const multiplier = Math.pow(Math.max(...filteredData), -1);
    return filteredData.map(n => n * multiplier);
}

function getVisualSyncDelay(slotIndex) {
    let wf = waveforms[slotIndex];
    let aed = audioElements[slotIndex].duration;
    let lineFrac = wf.lineFrac; //todo fill these in for each waveform
    return (wf.viewWidth * wf.waveZoom)/(wf.width+wf.viewWidth * wf.waveZoom*2) * aed;
}

function animate(svg, waveformWidth, viewWidth, viewHeight, speed, slotIndex) {
    let waveZoom = waveforms[slotIndex].waveZoom;
    let offset = -1 * viewWidth;
    let time = null;
    svg.setAttribute("width", viewWidth.toString());
    svg.setAttribute("viewBox", `${offset} 0 ${viewWidth*waveZoom} ${viewHeight}`);
    function draw(ts) {
        let waveZoom = waveforms[slotIndex].waveZoom;
        let zoomedViewWidth = viewWidth*waveZoom;
        let audio = audioElements[slotIndex];
        let audioProg = audio.currentTime / audio.duration;
        if (time === null) {
            time = ts;
            requestAnimationFrame(draw);
            return;
        }
        if (!svg.parentElement) return; //if this wave has been removed, don't requeue animation for it
        const diff = ts - time;
        const move = (diff / 1000) * speed;
        //have offset be determined buy currentTime on audio element
        offset += move;
        offset = audioProg * (waveformWidth + zoomedViewWidth*2) - zoomedViewWidth;
        if(!isNaN(offset)) {
            // if (offset > waveformWidth + zoomedViewWidth) {
            //     offset = -1 * zoomedViewWidth;
            // }
            svg.setAttribute("viewBox", `${offset} 0 ${zoomedViewWidth} ${viewHeight}`);
            time = ts;
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
    if (isComposer) {
        document.getElementById('control_panel').classList.remove('hide');
    } else {
        document.getElementById('time_slider_div').classList.remove('hide');
    }

    document.getElementById('beginButton').classList.add('hide');
    document.getElementById('fullscreen').classList.remove('hide');

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
    document.getElementById("installation").prepend(container);
    container.appendChild(createZigZag());

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

        animateAudioData(fetch(wf.url), i);

        createAudioElement(wf, i);
    });

    Promise.all(audioElementPromises).then(audioElems => {
        console.log("ready to play");
        audioElems.map(a => a.play())
    });
}


function goFullScreen() {
    const elem = document.getElementById('installation');

    if (elem.requestFullscreen) {
        elem.requestFullscreen();
        elem.className += 'css-selector';
    }
    else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
        elem.className += 'css-selector';
    }
    else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
        elem.className += 'css-selector';
    }
    else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
        elem.className += 'css-selector';
    }
}


function exitFullScreen() {
    const elem = document.getElementById('installation');
    if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
        elem.classList.remove('css-selector');
    }
}

document.addEventListener('fullscreenchange', exitFullScreen);
document.addEventListener('webkitfullscreenchange', exitFullScreen);
document.addEventListener('mozfullscreenchange', exitFullScreen);
document.addEventListener('MSFullscreenChange', exitFullScreen);



