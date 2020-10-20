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
    container.style.width = `${options.numBars * (options.barWidthPx + options.barSpacingPx)}px`;
    container.style.height = `${(options.numBars * options.barSmallestHeightPx) + options.barGrowthPx}px`;
    container.setAttribute("value", "0");
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

        bar.onpointerover = function () {
            if (bar.getAttribute("active") !== "true") bar.style.backgroundColor = options.barHighlightedColor;
            bar.style.height = `${barHeight + options.barGrowthPx}px`;
            bar.style.top = `${barTop - options.barGrowthPx}px`;
            bar.style.cursor = "pointer";
        };

        bar.onpointerleave = function () {
            if (bar.getAttribute("active") !== "true") bar.style.backgroundColor = options.barColor;
            currentBarHeight = bar.style.height.slice(0, -2);
            bar.style.height = `${barHeight}px`;
            bar.style.top = `${barTop}px`;
            bar.style.cursor = "auto";
        };

        bar.onpointerdown = function () {
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
            onChange((i + 1) / options.numBars);
        }
    }
}
