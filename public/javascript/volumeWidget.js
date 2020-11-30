// Utilities
function bisectRight(array, x) {
    for (var i = 0; i < array.length; i++) {
        if (array[i] > x) return i
    }
    return array.length
}

function quantize(value, quant) {
    /**
     * Quantizes a value to the closest value in a list of quantized values.
     * Args:
     *    value (float): Value to be quantized
     *    quant (List[float]): Quantized value options.
     * Returns:
     *    float: Quantized input value.
     */
    let mids = [];
    for (let i = 0; i < quant.length - 1; i++) mids[i] = (quant[i] + quant[i + 1]) / 2;
    let ind = bisectRight(mids, value);
    return quant[ind];
}

function range (n) { return [...Array(n).keys()] }

// API
function createVolumeWidget(containerID, onChange, customOptions) {
    let options = {
        numBars: 4,
        barWidthPx: 4,
        barSpacingPx: 4,
        barSmallestHeightPx: 4,
        barGrowthPx: 2,
        barColor: "gray",
        barHighlightedColor: "lightgray",
        startBar: 0,
    };

    options = {
        ...options,
        ...customOptions,
    };

    let container = document.getElementById(containerID);
    container.style.position = "relative";
    container.style.width = `${(options.numBars * (options.barWidthPx + options.barSpacingPx)) - options.barSpacingPx}px`;
    container.style.height = `${(options.numBars * options.barSmallestHeightPx) + options.barGrowthPx}px`;
    container.setAttribute("value", "0");
    container.style.cursor = "grab";

    let getBarsFromPointerEvent = (e) => {
        let containerRect = container.getBoundingClientRect();
        let x = e.clientX - containerRect.left;
        let positions = range(options.numBars).map(i => (i * (options.barWidthPx + options.barSpacingPx)) + (0.5 * options.barWidthPx));
        let barIndices = range(options.numBars);
        let barIndex = positions.indexOf(quantize(x, positions));
        barIndices.splice(barIndex, 1);
        return {
            currentBar: document.getElementById(`vol-bar-${barIndex}`),
            otherBars: barIndices.map(i => document.getElementById(`vol-bar-${i}`))
        }
    };

    // Used to check if bars need to change while grabbing and moving
    let down = false;

    container.onpointermove = function (e) {
        let {currentBar, otherBars} = getBarsFromPointerEvent(e);
        currentBar.over();
        otherBars.map(bar => bar.notOver());
        if (down) container.onpointerdown(e);
    };

    container.onpointerdown = function (e) {
        let { currentBar } = getBarsFromPointerEvent(e);
        currentBar.down();
        container.setPointerCapture(e.pointerId);
        container.style.cursor = "grabbing";
        down = true;
    };

    container.onpointerleave = function (e) {
        let { currentBar, otherBars } = getBarsFromPointerEvent(e);
        currentBar.notOver();
        otherBars.map(bar => bar.notOver());
    };

    container.onpointerup = function (e) {
        container.releasePointerCapture(e.pointerId);
        container.style.cursor = "grab";
        down = false;
    }

    // Used to debounce repeated calls to bar.down
    let lastValue = (options.startBar + 1) / options.numBars;

    for (let i = 0; i < options.numBars; i++) {
        let bar = document.createElement("span");
        bar.id = `vol-bar-${i}`;
        bar.setAttribute("touch-action", "none");
        bar.style.position = "absolute";
        bar.style.width = `${options.barWidthPx}px`;
        let barHeight = (i + 1) * options.barSmallestHeightPx;
        bar.style.height = `${barHeight}px`;
        let barTop = ((options.numBars - (i + 1)) * options.barSmallestHeightPx) + options.barGrowthPx;
        bar.style.top = `${barTop}px`;
        bar.style.left = `${i * (options.barWidthPx + options.barSpacingPx)}px`;
        bar.style.backgroundColor = i <= options.startBar ? options.barHighlightedColor : options.barColor;
        bar.setAttribute("active", i <= options.startBar ? "true" : "false");
        container.appendChild(bar);

        bar.over = function () {
            bar.style.height = `${barHeight + options.barGrowthPx}px`;
            bar.style.top = `${barTop - options.barGrowthPx}px`;
        };

        bar.notOver = function () {
            currentBarHeight = bar.style.height.slice(0, -2);
            bar.style.height = `${barHeight}px`;
            bar.style.top = `${barTop}px`;
        };

        bar.down = function () {
            for (let j = 0; j <= i; j++) {
                let activeBar = document.getElementById(`vol-bar-${j}`);
                activeBar.setAttribute("active", "true");
                activeBar.style.backgroundColor = options.barHighlightedColor;
            }

            for (let j = i + 1; j < options.numBars; j++) {
                let inactiveBar = document.getElementById(`vol-bar-${j}`);
                inactiveBar.setAttribute("active", "false");
                inactiveBar.style.backgroundColor = options.barColor;
            }
            let newValue = (i + 1) / options.numBars;
            if (newValue !== lastValue) {
                lastValue = newValue;
                onChange(newValue);
            }
        }
    }
}
