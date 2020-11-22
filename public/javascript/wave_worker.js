'use strict';

let waveforms = undefined;
let drawPointBuffers = [];
let rescaleVal = 1;

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
        postMessage(['framePoints', d[0], newPoints]);
    }
    if(e.data[0] === 'rescaleVal') rescaleVal = e.data[1];
}

function calculateWavePoints(slotIndex, viewWidth, waveProg, pixelsPerSample) {
    if(!drawPointBuffers[slotIndex] || !waveforms) return [[0,0]];
    
    let waveZoom = waveforms[slotIndex].waveZoom;
    let zoomedViewWidth = viewWidth*waveZoom; 

    let waveWidth = waveforms[slotIndex].viewWidth;
    let mirrored = waveforms[slotIndex].mirrored;
    let waveSampNum = Math.floor(waveWidth/pixelsPerSample);
    let zoomSampNum = Math.floor(waveSampNum * waveZoom);
    let {baseWaveArc, waveformHeight, width, baseLength, waveTop} = drawPointBuffers[slotIndex];
    let flipFunc = y => waveformHeight * 2 - y;
    let startInd = Math.floor(waveProg * baseLength);
    let endInd = startInd + zoomSampNum;
    if(waveTop.length <= startInd || waveTop.length < endInd) {
        let aaaa = 5;
    }
    if(!waveTop[startInd]) {
        let fuck = 5;
    }
    let xStart = waveTop[startInd][0];
    let topSlice = waveTop.slice(startInd, endInd);
    let sliceWidth = topSlice.slice(-1)[0][0] - xStart;
    let zoomedTopSlice = topSlice.map(([x, y]) => [(x-xStart)/sliceWidth * waveWidth, y]);
    // zoomedTopSlice = [[waveWidth/2, 20]];
    let endptY = mirrored ? waveformHeight : waveformHeight;
    zoomedTopSlice.splice(0, 0, [0, endptY]);
    zoomedTopSlice.push([waveWidth, endptY]);
    let backwards = zoomedTopSlice.map(([x, y]) => [x, flipFunc(y)]).reverse();
    let newPoints = [];
    if(mirrored) newPoints = zoomedTopSlice.concat(backwards);
    else newPoints = zoomedTopSlice.concat([backwards[0], backwards.slice(-1)[0]]);

    return newPoints.map(([x, y]) => [x*rescaleVal, y*rescaleVal]);
}