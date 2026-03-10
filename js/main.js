import {
    getCurrentState,
    resetMenu,
    updateDwellAndIdleStateMachine,
    STATES
} from "./timings.js";
import {
    drawMarkingMenu,
    updateSubmenuInteractionState,
    updateLevelInteractionState,
    interactionState,
    menuPosition,
    getHoveredSegmentForLevel,
    menu
} from "./menu.js";
import { updateCursor } from "./cursor.js";
import {
    drawSliderCanvas,
    getCurrentUiState,
    hideSlider,
    sliderState,
    updateSlider,
    UI_STATES,
    setCurrentUiState
} from "./slider.js";
import { updateGestures, drawGrabHint } from "./gestures.js";
import { initDebugControls } from "./debugControls.js";
import "./websocket.js"; // starts websocket

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");

/**
 * Function that adapts canvas to window size
 */
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    menuPosition.x = canvas.width / 2;
    menuPosition.y = canvas.height / 2;
}
window.addEventListener("resize", resize);
resize();
initDebugControls();

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

    if (!menu || !menu.items) return;   // necessary if menu data was not received yet
    menu.radius = Number(localStorage.getItem("menuRadius")) || menu.radius;

    // check if hand is detected -> if yes, reset timers; if not, update idle timer
    const handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
    updateGestures(results, handDetected)
    updateDwellAndIdleStateMachine(handDetected, now, results);
    const currentState = getCurrentState();

    // if no hand is detected (and 0.5s passed), all selection/hovers are reset + reset previously selected slider
    if(resetMenu(handDetected, now)){
        for (let i = 0; i < interactionState.levels.length; i++) {
            interactionState.levels[i].selected = null;
            interactionState.levels[i].hover = null;
        }
        hideSlider();
        setCurrentUiState(UI_STATES.MENU);
    }

    // if menu is not in activation mode (visible), draw menu
    if (currentState === STATES.MENU || currentState === STATES.IDLE || currentState === STATES.DWELL) {
        if (handDetected) {
            // if slider is active, do not update menu
            if (getCurrentUiState() === UI_STATES.SLIDER) {
                updateSlider(results, handDetected);
            } else {
                drawGrabHint(window.innerWidth/2, window.innerWidth/20);
                interactionState.levels[0].hover = getHoveredSegmentForLevel(0);

                // draw hover animation for all levels
                for (let i = 0; i < interactionState.levels.length; i++) {
                    updateLevelInteractionState(now, i);
                }
            }
        }
        drawMarkingMenu();
        updateSubmenuInteractionState(handDetected)
        drawSliderCanvas();
        updateCursor(results, handDetected);
    }
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

