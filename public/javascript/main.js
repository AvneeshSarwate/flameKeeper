// Receives variable returns from template

const AudioContext = window.AudioContext || window.webkitAudioContext
const audioCtx = new AudioContext();

document.getElementById('beginButton').addEventListener('click', begin);
document.getElementById('fullscreen').addEventListener('click', goFullScreen);


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

let audioElements = [];
let waveformGroups = [];
let gains = [];

// Nice convenient way to describe the waveforms.
const waveforms = [
    {
        url: `https://flamekeeper.s3.amazonaws.com/${returns[0]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 290,
        transform: `translate(10 40)`,
        zIndex: -1,
        panAmount: -0.75

    },
    {
        url: `https://flamekeeper.s3.amazonaws.com/${returns[1]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 190,
        transform: `translate(180 110) rotate(90)`,
        zIndex: -1,
        panAmount: 0.5

    },
    {
        url: `https://flamekeeper.s3.amazonaws.com/${returns[2]}`,
        speed: 15,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 200,
        transform: `translate(400 200) rotate(180)`,
        zIndex: -1,
        panAmount: 0.75
    },
    {
        url: `https://flamekeeper.s3.amazonaws.com/${returns[3]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 200,
        transform: `translate(400 260) rotate(180)`,
        zIndex: 1,
        panAmount: 0.25
    },
    {
        url: `https://flamekeeper.s3.amazonaws.com/${returns[4]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 190,
        transform: `translate(420 300) rotate(270)`,
        zIndex: -1,
        panAmount: 0

    },
    {
        url: `https://flamekeeper.s3.amazonaws.com/${returns[5]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 120,
        transform: `translate(480 270)`,
        zIndex: -1,
        panAmount: -0.25

    },
    {
        url: `https://flamekeeper.s3.amazonaws.com/${returns[6]}`,
        speed: 10,
        mirrored: true,
        viewHeight: 30,
        viewWidth: 120,
        transform: `translate(380 330)`,
        zIndex: -1,
        panAmount: -0.5

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

function createAudioElement(wf) {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    if (returns.length > 0) audio.src = wf.url;
    audio.loop = true;

    //- setTimeout(function() {
    //-   audio.play();
    //- }, 5000);

    audio.addEventListener("canplaythrough", () => { audio.play() });

    audioElements.push(audio);

    document.body.appendChild(audio);
    const source = audioCtx.createMediaElementSource(audio);

    //- const panner = new PannerNode(audioCtx);

    const compressor = audioCtx.createDynamicsCompressor();
    const gain = audioCtx.createGain();
    gains.push(gain);
    compressor.threshold.setValueAtTime(-10, audioCtx.currentTime);
    compressor.knee.setValueAtTime(40, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.25, audioCtx.currentTime);
    //todo - initialize gain from state data

    //- panner.setPosition(wf.panAmount,0,1-Math.abs(wf.panAmount));
    //- source.connect(panner).connect(compressor).connect(audioCtx.destination);
    source.connect(gain).connect(compressor).connect(audioCtx.destination);
}

function drawWaveformBackground(wf, group, i) {
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", 0);
    bgRect.setAttribute("y", 0);
    bgRect.setAttribute("height", wf.viewHeight * 2);
    bgRect.setAttribute("width", wf.viewWidth);
    bgRect.setAttribute("fill", TRANSPARENT_COLOR);
    bgRect.setAttribute("stroke", 'white');
    bgRect.setAttribute('stroke-width', '0px');
    bgRect.setAttribute('id', 'bgRect-' + i);

    group.appendChild(bgRect);
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

    return { waveformWidth: width, svg };
}

function normalizeData(filteredData) {
    const multiplier = Math.pow(Math.max(...filteredData), -1);
    return filteredData.map(n => n * multiplier);
}

function animate(svg, waveformWidth, viewWidth, viewHeight, speed, ind) {
    let offset = -1 * viewWidth;
    let time = null;
    svg.setAttribute("width", viewWidth.toString());
    svg.setAttribute("viewBox", `${offset} 0 ${viewWidth * 0.5} ${viewHeight}`);
    function draw(ts) {
        const wv = waveforms[ind];
        viewWidth = wv.viewWidth;
        viewHeight = wv.viewHeight * (wv.mirrored ? 2 : 1);
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
        if (offset > waveformWidth + viewWidth) {
            offset = -1 * viewWidth;
        }
        svg.setAttribute("viewBox", `${0} 0 ${viewWidth} ${viewHeight}`);
        time = ts;
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
}

function begin() {
    document.getElementById('beginButton').classList.add('hide');

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

        createAudioElement(wf);
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