'use strict';

let waveforms = undefined;
let drawPointBuffers = [];

onmessage = function(e){
    if(e.data[0] === 'waveforms') {
        waveforms = e.data[1];
    }
    if(e.data[0] === 'drawPointBuffers') {
        drawPointBuffers[e.data[1]] = e.data[2];
    }
    if(e.data[0] === 'getString'){
        let d = e.data.slice(1);
        let newPoints = calculateWavePoints(d[0], d[1], d[2], d[3]);
        let ptString = newPoints.map(([x, y]) => `${x},${y}`).join(" ");
        postMessage(['ptString', d[0], ptString]);
        // postMessage(['framePoints', d[0], newPoints]);
    }
}

function calculateWavePoints(slotIndex, viewWidth, waveProg, pixelsPerSample) {
    if(!drawPointBuffers[slotIndex] || !waveforms) return [[0,0]];
    
    let waveZoom = waveforms[slotIndex].waveZoom;
    let zoomedViewWidth = viewWidth*waveZoom; 

    let waveWidth = waveforms[slotIndex].viewWidth;
    let waveSampNum = Math.floor(waveWidth/pixelsPerSample);
    let zoomSampNum = waveSampNum * waveZoom;
    let {baseWaveArc, waveformHeight, width, baseLength, waveTop} = drawPointBuffers[slotIndex];
    let flipFunc = y => waveformHeight * 2 - y;
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

    return newPoints;
}