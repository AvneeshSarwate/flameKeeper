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
    show_wave_numbers: true
};

const MAX_ZOOM_OUT = 3;

[0, 1, 2, 3, 4, 5, 6].forEach(i => {
    gui.add(controllerProps, 'zoom'+i, 0, MAX_ZOOM_OUT, 0.01).onFinishChange(v => {
        waveforms[i].waveZoom = v;
        delays[i].delayTime.value = getVisualSyncDelay(i);
    });
});
// gui.addColor(controllerProps, 'color1');
// gui.addColor(controllerProps, 'color2');

[0, 1, 2, 3, 4, 5, 6].forEach(i => {
    gui.add(controllerProps, 'swap_file_'+i);
    document.getElementById('fileSwap-'+i).addEventListener('change', (e) => {
        replaceAudioSlotWithFile(e.target.files[0], i);
    });
});

gui.add(controllerProps, 'show_wave_numbers').onChange(v => {
    let visibility = v ? 'visible' : 'hidden';
    let labels = document.getElementsByTagNameNS("http://www.w3.org/2000/svg", "text");
    [0, 1, 2, 3, 4, 5, 6].forEach(i => {labels[i].style.visibility = visibility});
});

[0, 1, 2, 3, 4, 5, 6].forEach(i => {
    controllerProps['x-'+i] = 0;
    controllerProps['y-'+i] = 0;
    controllerProps['direction-'+i] = 'forward';
    controllerProps['mirrored-'+i] = true;

    let folder_n = gui.addFolder("positioning-"+i);
    folder_n.add(controllerProps, 'x-'+i).onFinishChange(() => setWavePosition(i));
    folder_n.add(controllerProps, 'y-'+i).onFinishChange(() => setWavePosition(i));
    folder_n.add(controllerProps, 'direction-'+i, ['forward', 'backward', 'up', 'down']).onFinishChange(() => setWavePosition(i));
    // folder_n.add(controllerProps, 'mirrored-'+i).onFinishChange(() => setWavePosition(i));
});

controllerProps['download_parameters'] = function() {
    let positionString = JSON.stringify(controllerProps);
    download(`Installation Settings ${Date.now()}.txt`, positionString);
}

gui.add(controllerProps, 'download_parameters');

function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

window.onbeforeunload = function() {
    return true;
};


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
        refreshGradient();
        
    }, 2 * 1000);
}, 1000 * 2);


function enableEditing(){
    let editTime = new Date(lastEditTime + 14 * 60 * 60 * 1000).toLocaleString();
    document.getElementById("single_panel").classList.remove("hide");
    document.getElementById("time_warning").innerText = `You have until ${editTime} to make changes`;
}

function disableEditing() {
    let editTime = new Date(lastEditTime + 7 * 60 * 60 * 1000).toLocaleString();
    document.getElementById("time_warning").innerText = "You cannot make changes until " + editTime;
    document.getElementById("single_panel").classList.add("hide");
}


document.getElementById('jump_time_button').addEventListener('click', jumpToTime);
document.getElementById('undo_button').addEventListener('click', undoReplace);
document.getElementById('vol').addEventListener('input', changeVol);
document.getElementById('replace_file_input').addEventListener('change', replaceFile);
document.getElementById('replace_file_submit').addEventListener('click', submit);

if(isLocked){
    disableEditing();
} else {
    enableEditing();
}

document.getElementById('beginButton').addEventListener('click', begin);
document.getElementById('fullscreen').addEventListener('click', goFullScreen);

let selected_waveform = null;
let audioElements = [];
let audioElementPromises = [];
let waveformGroups = [];
let gains = [];
let muteGains = [];
let delays = [];
let file_is_replaced = false;
let lastVolume = null; //the previos volume of the slot was replaced. saved for undo in single-replace mode
let submissionData = {};
let candidateFileUrl = null;

function undoReplace() {
    document.getElementById('undo_button').classList.add('hide');
    document.getElementById('replace_file_button').classList.add('hide');
    document.getElementById('vol_span').classList.add('hide');
    document.getElementById('replace_file_span').classList.remove('hide');


    const undoWave = selected_waveform;
    animateAudioData(fetch(waveforms[undoWave].url), undoWave).then(() => {
        audioElements[undoWave].src = waveforms[undoWave].url;

        audioElements[undoWave].oncanplaythrough = () => {
            audioElements[undoWave].play().then(() => {
                audioElements[undoWave].oncanplaythrough = null; //prevent infinite loop - setting current time trigers 'canplaythrough' event
                delays[undoWave].delayTime.value = getVisualSyncDelay(undoWave);
                audioElements.forEach(a => {a.currentTime = 0});
            });
        };
    });
    resetGains();

    file_is_replaced = false;
    selected_waveform = null;
    toggleGroupBorders();

    document.getElementById('replace_file_input').value = '';

    submissionData = {};
}

function submit() {
    if(audioElements[selected_waveform].duration > 440) {
        alert("select an audio file less than 2 minutes long");
        return
    }
    let formData = new FormData();
    if (Object.keys(submissionData).length > 0) {
        for (k in submissionData) {
            formData.append(k, submissionData[k]);
        }
        formData.append("composerID", authenticatedUserID);
        fetch('/upload', {
            method: 'POST', // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, *cors, same-origin
            credentials: 'same-origin', // include, *same-origin, omit
            body: formData
        }).then(res => {
            if(res.status != 200) {
                res.text().then(t => alert(t));
            }
        }).catch(err => {
            console.error("unable to upload", err);
        });
    }
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
        document.getElementById('replace_file_submit').classList.remove('hide');
        document.getElementById('vol_span').classList.remove('hide');
        document.getElementById('replace_file_span').classList.add('hide');

        candidateFileUrl = URL.createObjectURL(files[0])
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
        audio.currentTime = (audioTime / 1000) % audio.duration; 
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
            Promise.all(newAudioPromises).then(audioElems => {
                audioElems.map((a, i) => {
                    a.play();
                    delays[i].delayTime.value = getVisualSyncDelay(i);
                });
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
const MUTE_COLOR = 'black';
const HIGHLIGHT_COLOR = "#ff5050aa";
const TRANSPARENT_COLOR = "#ffffff00";

const DEBUG = true;

/*
(note rotation y point should be 2x if mirrored == true)
how to set translations after rotations
    - 180: x y -> -x -y (forward)
    - 90 : x y ->  y -x (up)
    - 270: x y -> -y  x (down)
    - 0  : x y ->  x  y (backward)
*/

function setWavePosition(slot_index){
    let wave = waveforms[slot_index];

    let rawx = controllerProps["x-"+slot_index];
    let rawy = controllerProps["y-"+slot_index];
    let direction = controllerProps["direction-"+slot_index];
    let mirrored = controllerProps["mirrored-"+slot_index];

    mirrored = wave.mirrored;

    let angle, x, y;
    if(direction == "forward")  [angle, x, y] = [180, -rawx, -rawy];
    if(direction == "backward") [angle, x, y] = [0,    rawx,  rawy];
    if(direction == "up")       [angle, x, y] = [90,   rawy, -rawx];
    if(direction == "down")     [angle, x, y] = [270, -rawy,  rawx];
    let [center_x, center_y] =  [wave.viewWidth/2, mirrored ? wave.viewHeight : wave.viewHeight/2];

    let group_elem = document.getElementById('group-'+slot_index);
    group_elem.setAttribute("transform", `rotate(${angle} ${center_x} ${center_y}) translate(${x} ${y})`);
}

function printTransform(rawx, rawy, direction, slot_index){
    let mirrored = controllerProps["mirrored-"+slot_index];
    let wave = waveforms[slot_index];

    mirrored = wave.mirrored;

    let angle, x, y;
    if(direction == "forward")  [angle, x, y] = [180, -rawx, -rawy];
    if(direction == "backward") [angle, x, y] = [0,    rawx,  rawy];
    if(direction == "up")       [angle, x, y] = [90,   rawy, -rawx];
    if(direction == "down")     [angle, x, y] = [270, -rawy,  rawx];
    let [center_x, center_y] =  [wave.viewWidth/2, mirrored ? wave.viewHeight : wave.viewHeight/2];

    console.log("transform string", `rotate(${angle} ${center_x} ${center_y}) translate(${x} ${y})`);
}

function printTransform2(rawx, rawy, direction, rect, mirrored){
    let width = rect.width.baseVal.value / 2;
    let height = rect.height.baseVal.value;
    let angle, x, y;
    if(direction == "forward")  [angle, x, y] = [180, -rawx, -rawy];
    if(direction == "backward") [angle, x, y] = [0,    rawx,  rawy];
    if(direction == "up")       [angle, x, y] = [90,   rawy, -rawx];
    if(direction == "down")     [angle, x, y] = [270, -rawy,  rawx];
    let [center_x, center_y] =  [width/2, mirrored ? height : height/2];

    return `rotate(${angle} ${center_x} ${center_y}) translate(${x} ${y})`;
}

function debugRect(height, width) {
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", 0);
    bgRect.setAttribute("y", 0);
    bgRect.setAttribute("height", height);
    bgRect.setAttribute("width", width);
    bgRect.setAttribute("fill", TRANSPARENT_COLOR);
    bgRect.setAttribute("stroke", 'white');
    bgRect.setAttribute('stroke-width', '0px');
    bgRect.setAttribute('id', 'debug');
    return bgRect;
}

// Nice convenient way to describe the waveforms.
const waveforms = [
    {//Wave-0
        url: `https://flamekeeper.s3.amazonaws.com/${returns[0]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 25.5,
        viewWidth: 290,
        transform: `rotate(0 145 30) translate(50 30)`,
        zIndex: -1,
        panAmount: -0.75,
        delay: 2.155, 
        waveZoom: 1.29,
        linePercent: 0.69
    },
    {//Wave-1
        url: `https://flamekeeper.s3.amazonaws.com/${returns[1]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 190,
        transform: `rotate(90 47.5 60) translate(97.5 -72.5)`,
        zIndex: -1,
        panAmount: 0.5,
        delay: 2.48, 
        waveZoom: 2.73,
        linePercent: 0.85
    },
    {//Wave-2
        url: `https://flamekeeper.s3.amazonaws.com/${returns[2]}`,
        speed: 15,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 200,
        transform: `rotate(0 100 30) translate(200 150)`,
        zIndex: -1,
        panAmount: 0.75,
        delay: 1.53, 
        waveZoom: 2.2,
        linePercent: 0.51
    },
    {//Wave-3
        url: `https://flamekeeper.s3.amazonaws.com/${returns[3]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 200,
        transform: `rotate(180 100 30) translate(-200 -195)`,
        zIndex: -1,
        panAmount: 0.25,
        delay: 1.35, 
        waveZoom: 2.4,
        linePercent: 0.51
    },
    {//Wave-4
        url: `https://flamekeeper.s3.amazonaws.com/${returns[4]}`,
        speed: 10,
        mirrored: false,
        viewHeight: 30,
        viewWidth: 190,
        transform: `rotate(270 47.5 30) translate(-222.5 402.5)`,
        zIndex: -1,
        panAmount: 0,
        delay: 2.27, 
        waveZoom: 1.59,
        linePercent: 0.79
    },
    {//Wave-5
        url: `https://flamekeeper.s3.amazonaws.com/${returns[5]}`,
        speed: 10,
        mirrored: false,
        viewHeight: 30,
        viewWidth: 190,
        transform: `rotate(270 47.5 15) translate(-237.5 447.5) scale(1 -1)`,
        zIndex: -1,
        panAmount: -0.25,
        delay: 0.47, 
        waveZoom: 2.73,
        linePercent: 0.215
    },
    {//Wave-6
        url: `https://flamekeeper.s3.amazonaws.com/${returns[6]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 230,
        transform: `rotate(180 60 30) translate(-400 -310)`,
        zIndex: -1,
        panAmount: -0.5,
        delay: 0, 
        waveZoom: 1.13,
        linePercent: 0
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

    return audioDataPromise
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            let bufferPromise = new Promise(resolve => {
                audioCtx.decodeAudioData(arrayBuffer, resolve);
            });
            return bufferPromise
        })
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
        audio.currentTime = ((Date.now() - timestamp) / 1000) % audio.duration; 
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


    const muteGain = audioCtx.createGain();
    muteGain.gain.value = 1;
    muteGains.push(muteGain);

    const delay = audioCtx.createDelay(5);
    delay.delayTime.value = waveforms[slotIndex].delay;
    delays.push(delay);
    
    compressor.threshold.setValueAtTime(-10, audioCtx.currentTime);
    compressor.knee.setValueAtTime(40, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

    //- panner.setPosition(wf.panAmount,0,1-Math.abs(wf.panAmount));
    //- source.connect(panner).connect(compressor).connect(audioCtx.destination);
    source.connect(gain).connect(delay).connect(compressor).connect(muteGain).connect(audioCtx.destination);
}

function toggleGroupBorders() {
    [0, 1, 2, 3, 4, 5, 6].map(i => {
        const bgRect = document.getElementById('bgRect-' + i);
        bgRect.setAttribute("stroke-width", selected_waveform === i ? '3px' : '0px')
    });
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
    label.textContent = "" + i;
    label.setAttribute("x", wf.viewWidth/2);
    label.setAttribute("y", view_height/2);
    label.setAttribute("fill", "red");

    group.appendChild(label);
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

        group.ondblclick = () => {
            selected_waveform = null;
            toggleGroupBorders();
            let waveColor, muteVol;
            if(muteGains[i].gain.value == 1) {
                [waveColor, muteVol] = [MUTE_COLOR, 0]
            } else {
                [waveColor, muteVol] = [WAVEFORM_COLOR, 1]
            }
            document.getElementById('waveline-'+i).setAttribute('fill', waveColor);
            document.getElementById('zeroline-'+i).setAttribute('fill', waveColor);
            muteGains[i].gain.value = muteVol;
        };

        group.onmouseenter = () => { bgRect.setAttribute("fill", HIGHLIGHT_COLOR) };
        group.onmouseleave = () => { bgRect.setAttribute("fill", TRANSPARENT_COLOR) };
    }
}

function drawZeroLine(wf, group, slotIndex) {
    // Draw line at zero to make the no-waveform part look better.
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", 0);
    line.setAttribute("x2", wf.viewWidth);
    line.setAttribute("y1", wf.viewHeight);
    line.setAttribute("y2", wf.viewHeight);
    line.setAttribute("stroke", WAVEFORM_COLOR);
    line.setAttribute("id", "zeroline-"+slotIndex)
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
    line.setAttribute('id', 'waveline-'+slotIndex)
    svg.appendChild(line);

    waveforms[slotIndex].width = width;
    let wf = waveforms[slotIndex];
    // if(width < wf.viewWidth * MAX_ZOOM_OUT){
        //todo - clean this up and to only copy over end-part of wave when file is large 
        let numRepeats = Math.max(Math.floor(wf.viewWidth * MAX_ZOOM_OUT / width), 1); 
        let waveCopyStrings = [];
        for(let i = 0; i < numRepeats; i++){
            let repeat = points.map(([x, y]) => `${x-(i+1)*width},${y}`).join(" "); //copy of the waveform shifted i wavelengths
            waveCopyStrings.push(repeat);
        }
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
    let aed = audioElements[slotIndex].duration;
    let lineFrac = wf.linePercent; 
    return (wf.viewWidth * wf.waveZoom)/(wf.width+wf.viewWidth * wf.waveZoom*0) * aed * lineFrac;
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
        offset = audioProg * (waveformWidth + zoomedViewWidth*0) - zoomedViewWidth;
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
    container.setAttribute("preserveAspectRatio", "none");
    if (DEBUG) {
        container.setAttribute("style", "border: 1px solid black;"); // just for visualization
    }
    container.setAttribute("width", "100%");
    container.setAttribute("viewBox", `0 0 ${CONTAINER_WIDTH} ${CONTAINER_HEIGHT}`);
    document.getElementById("installation").prepend(container);
    container.appendChild(createZigZag());

    let drawPromises = [];

    waveforms.forEach((wf, i) => {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", wf.transform);
        group.setAttribute("id", "group-" + i);

        drawWaveformBackground(wf, group, i);

        drawZeroLine(wf, group, i);

        if (wf.zIndex < 0) {
            container.prepend(group);
        } else {
            container.appendChild(group);
        }

        drawPromises.push(animateAudioData(fetch(wf.url), i));

        createAudioElement(wf, i);
    });

    Promise.all([audioElementPromises, drawPromises].flat()).then(() => {
        console.log("ready to play");
        audioElements.map((a, i) => {
            a.play();
            delays[i].delayTime.value = getVisualSyncDelay(i);
        });
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


