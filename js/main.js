import { dwellProgress, resetTimers, updateIdle, updateDwell, drawDwellRing } from "./timings.js";
import {
    drawMarkingMenu,
    updateSubMenuState,
    updateHoverFill,
    updateSubHover,
    getActiveMainSegment,
    menuState
} from "./menu.js";
import { updateCursor } from "./cursor.js";
import { menu } from "./menu.js";
import { drawSliderCanvas, updateSlider,} from "./slider.js";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");

// adapt canvas to window size
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    menu.x = canvas.width / 2;
    menu.y = canvas.height / 2;
}
window.addEventListener("resize", resize);
resize();

// instiate mediapipe hand
const hands = new Hands({
    locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
});

// results per frame
hands.onResults((results) => {
    const now = performance.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let activeMainSegment = -1;

    // check if hand is detected -> if yes, reset timers; if not, update idle timer
    const handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
    if(handDetected && dwellProgress > 0){
        resetTimers()
    }
    const dwellShouldRun = updateIdle(handDetected, now);

    // if dwell timer should run, update values and draw it
    if (dwellShouldRun) {
        updateDwell(now);
    }

    // if dwell timer is running, draw dwell ring
    if (dwellProgress > 0 && dwellProgress < 1) {
        drawDwellRing(dwellProgress);
    }

    // if dwell timer is not active or <1, paint menu
    if (dwellProgress < 1) {
        if (handDetected) {
            updateCursor(results);
            updateSlider(results);
            menuState.hoverPath[0] = getActiveMainSegment();
            updateHoverFill(now);
            updateSubHover(now)
        }
        drawMarkingMenu();

        // if slider data is available, this draws the slider
        drawSliderCanvas();
    }

    updateSubMenuState(handDetected)
});

// start camera
const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 1280,
    height: 720,
});

camera.start();

