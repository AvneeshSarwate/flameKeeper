const { raw } = require("express");

let a0_vis;
let a0_player = new Tone.Player("'/new-ui-test/A0.mp3", () => {
    a0_vis = generateDrawingBuffer(a0_player);
    startPlaybackAndAnimation();
}).toDestination();

let visibleTime = 1; //e.g how many seconds of the audio clip are visible in the scrolling waveform window
let blocksPerSec = 50; //e.g. how many samples will visualize a second of audio
let visibleBlocks = visibleTime * blocksPerSec;

function generateDrawingBuffer(tonePlayer) {
    let rawData = tonePlayer.buffer.getChannelData(0);
    let audioSamplesPerVisualSample = tonePlayer.buffer.sampleRate / blocksPerSec;
    let visualSamples = [];
    for (let i = 0; i < rawData.length; i += audioSamplesPerVisualSample) {
        let visualSampleVal = 0;
        for (let j = 0; j < audioSamplesPerVisualSample; j++) {
            visualSampleVal += Math.abs(rawData[i + j]);
        }
        visualSamples.push(visualSamples / audioSamplesPerVisualSample);
    }
    return visualSamples;
}

let width = window.innerWidth;
let height = window.innerHeight;

let stage = new Konva.Stage({
    container: 'konvaContainer',
    width: width,
    height: height,
});

function startPlaybackAndAnimation() {

}

let layer = new Konva.Layer();
// add the layer to the stage
stage.add(layer);

var wave = new Konva.Shape({
    x: 0,
    y: 0,
    fill: '#00D2FF',
    width: 100,
    height: 50,
    sceneFunc: function (context, shape) {
        context.beginPath();
        let rectWidth = shape.getAttr('width') / visibleBlocks;
        let height = shape.getAttr('height');
        for(let i = 0; i < visibleTime; i++){
            let residualHeight = 1 - a0_vis[]
            context.rect(i*rectWidth, 0, rectWidth,  );
        }
        
        context.fillStrokeShape(shape);
    }
});