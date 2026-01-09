import { dwellProgress, handleDwellAndIdle, menuUnlocked, setMenuUnlocked } from "./timings.js";
import {
    drawMarkingMenu,
    updateSubMenuState,
    updateHoverFill,
    getActiveMainSegment,
    interactionState
} from "./menu.js";
import { updateCursor } from "./cursor.js";
import { menu } from "./menu.js";
import { drawSliderCanvas, hideSlider, sliderState, updateSlider } from "./slider.js";
import { updateIsGrabbing } from "./gestures.js";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");

/**
 * Function that adapts canvas to window size
 */
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

    // check if hand is detected -> if yes, reset timers; if not, update idle timer
    const handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
    handleDwellAndIdle(handDetected, now);
    if(!menuUnlocked) return;

    // if no hand is detected, all selection/hovers are reset + reset previously selected slider
    if (!handDetected) {
        interactionState.main.selected = null;
        interactionState.main.hover = null;
        interactionState.sub.hover = null;
        interactionState.sub.selected = null;
        sliderState.selectedSliderType = null;
        hideSlider();
    }

    // if dwell timer is not active or <1, paint menu
    if (dwellProgress < 1) {
        if (handDetected) {
            updateIsGrabbing(results, handDetected);
            updateCursor(results);
            updateSlider(results);
            interactionState.main.hover = getActiveMainSegment();
            updateHoverFill(now, 0);    // main manu
            updateHoverFill(now, 1);    // sub menu
        }
        drawMarkingMenu();

        // if slider data is available, this draws the slider
        drawSliderCanvas();
    } else {
        setMenuUnlocked(false);
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
video.style.display = "none";

