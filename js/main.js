import {
    drawGestureIcon,
    dwellProgress,
    handleDwellAndIdle,
    menuUnlocked,
    setMenuUnlocked
} from "./timings.js";
import {
    drawMarkingMenu,
    updateSubMenuState,
    updateHoverFill,
    getActiveMainSegment,
    interactionState,
    UI_SCALE
} from "./menu.js";
import { updateCursor } from "./cursor.js";
import { menu } from "./menu.js";
import { drawSliderCanvas, hideSlider, sliderState, uiMode, updateSlider } from "./slider.js";
import { gestureThresholds, updateGestures, drawGrabHint } from "./gestures.js";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");

const MOVE_STEP = 20;   // steps to rescale menu

/**
 * This method uses keyboard keys to scale the radius of the menu and move the menu.
 * This method can also increase/decrease gesture detection thresholds
 * This is only for testing and debugging and NO user should ever use this.
 */
window.addEventListener("keydown", (e) => {
    switch (e.key) {

        // scale menu with + and -
        case "+":
            resizeMenu(UI_SCALE.radiusStep);
            break;
        case "-":
            resizeMenu(-UI_SCALE.radiusStep);
            break;

        // move menu with arrow keys
        case "ArrowLeft":
            menu.x -= MOVE_STEP;
            break;
        case "ArrowRight":
            menu.x += MOVE_STEP;
            break;
        case "ArrowUp":
            menu.y -= MOVE_STEP;
            break;
        case "ArrowDown":
            menu.y += MOVE_STEP;
            break;

        // increase/decrease gesture thresholds
        case "p":
            gestureThresholds.pinchThreshold += 0.1;
            console.log("pinchThreshold", gestureThresholds.pinchThreshold)
            break;
        case "h":
            gestureThresholds.pinchThreshold -= 0.1;
            console.log("pinchThreshold", gestureThresholds.pinchThreshold)
            break;
        case "g":
            gestureThresholds.grabThreshold += 0.1;
            console.log("grabThreshold", gestureThresholds.grabThreshold)
            break;
        case "b":
            gestureThresholds.grabThreshold -= 0.1;
            console.log("grabThreshold", gestureThresholds.grabThreshold)
            break;
        case "o":
            gestureThresholds.openPalmThreshold += 0.1;
            console.log("openPalmThreshold", gestureThresholds.openPalmThreshold)
            break;
        case "m":
            gestureThresholds.openPalmThreshold -= 0.1;
            console.log("openPalmThreshold", gestureThresholds.openPalmThreshold)
            break;
    }
});

function resizeMenu(delta) {
    const newRadius = menu.radius + delta;

    if (
        newRadius < UI_SCALE.minRadius ||
        newRadius > UI_SCALE.maxRadius
    ) return;

    menu.radius = newRadius;
}

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
    locateFile: (file) => `./lib/mediapipe/hands/${file}`,
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
    updateGestures(results, handDetected)
    drawGestureIcon(handDetected);     // draw hand Icon
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
        uiMode.current = "menu";
    }

    // if dwell timer is not active or <1, paint menu
    if (dwellProgress < 1) {
        if (handDetected) {
            // if slider is active, do not update menu
            if (uiMode.current === "slider") {
                updateSlider(results, handDetected);
            } else {
                drawGrabHint(window.innerWidth/2, 200);
                updateCursor(results);
                interactionState.main.hover = getActiveMainSegment();
                updateHoverFill(now, 0);    // main manu
                updateHoverFill(now, 1);    // sub menu
            }
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

