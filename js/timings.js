import {ctx} from "./main.js";
import { isPinched, isGrabbing, isOpenHand } from "./gestures.js";
import { setCursorOffsetToMenuCenter } from "./cursor.js";

// idle dwell for no interaction
let idleStartTime = null;          // saves start time of idle timer
let dwellStartTime = null;         // saves start time of dwell timer
let dwellProgress = 0;      // 0..1, shows percentage of how far filled dwell circle is
const IDLE_BEFORE_DWELL = 3000; // systems waits this time if no hand was recognized -> after this time dwell timer is started
const DWELL_DURATION = 3000;    // time for the dwell timer

// activation dwell
let activationStartTime = null;
const ACTIVATION_DURATION = 3000; // 3s Freischalt-Dwell

// gesture icons
const handIcon = new Image();
handIcon.src = "./images/gestures/hand.png";
const pinchIcon = new Image();
pinchIcon.src = "./images/gestures/pinch.png";
const grabIcon = new Image();
grabIcon.src = "./images/gestures/grab.png";

let lastHandSeenTime = performance.now();
const HAND_LOST_TIMEOUT = 500;

export const STATES = {
    ACTIVATION: "activation",   // no menu is there and no hand is detected
    MENU: "menu",               // menu is visible and hand is detected
    IDLE: "idle",               // menu is visible but no hand was detected for <3s
    DWELL: "dwell"              // menu is visible but no hand was detected for >3s and dwell ring is visible
};

let currentState = STATES.ACTIVATION;

/**
 * Function that handles state machine (if menu is visible and all dwell/idle timers)
 * @param handDetected
 * @param now
 * @param results
 */
export function updateDwellAndIdleStateMachine(handDetected, now, results) {
    switch (currentState) {
        case STATES.ACTIVATION:
            updateActivation(handDetected, now, results);
            break;

        case STATES.MENU:
            updateMenu(handDetected, now);
            break;

        case STATES.IDLE:
            updateIdleState(handDetected, now);
            break;

        case STATES.DWELL:
            updateDwellState(handDetected, now);
            break;
    }
}

/**
 * Helper function that handles activation timer if hand was detected
 * - switch to menu mode if hand was detected >3s
 * @param handDetected
 * @param now
 * @param results
 */
function updateActivation(handDetected, now, results) {
    // do nothing if no hand was detected
    if (!handDetected || !isOpenHand) {
        activationStartTime = null;
        dwellProgress = 0;
        return;
    }

    if (!activationStartTime) {
        activationStartTime = now;
        return;
    }

    const elapsed = now - activationStartTime;
    dwellProgress = Math.min(elapsed / ACTIVATION_DURATION, 1);
    drawDwellRing()

    if (dwellProgress >= 1) {
        activationStartTime = null;
        transitionTo(STATES.MENU);
        dwellProgress = 0;
        setCursorOffsetToMenuCenter(results);
    }
}

/**
 *  Helper function that handles menu state
 *  - if no hand was detected, switch to idle mode
 * @param handDetected
 * @param now
 */
function updateMenu(handDetected, now) {
    if (!handDetected) {
        idleStartTime = now;
        transitionTo(STATES.IDLE);
    }
}

/**
 * Helper function that handles idle timer if no hand was detected <3s
 * - switch to menu mode if hand was detected
 * - switch to dwell mode if no hand was detected >3s
 * @param handDetected
 * @param now
 */
function updateIdleState(handDetected, now) {
    if (handDetected) {
        idleStartTime = null;
        transitionTo(STATES.MENU);
        return;
    }

    if (!idleStartTime) {
        idleStartTime = now;
        return;
    }

    if (now - idleStartTime >= IDLE_BEFORE_DWELL) {
        dwellStartTime = now;
        transitionTo(STATES.DWELL);
    }
}

/**
 * Helper function that handles dwell timer if no hand was detected >3s
 * - switch to menu mode if hand was detected
 * - draw dwell ring
 * - switch to activation mode if no hand was detected again >3s
 * @param handDetected
 * @param now
 */
function updateDwellState(handDetected, now) {
    if (handDetected) {
        dwellStartTime = null;
        transitionTo(STATES.MENU);
        return;
    }

    if (!dwellStartTime) {
        dwellStartTime = now;
        return;
    }

    const elapsed = now - dwellStartTime;
    dwellProgress = Math.min(elapsed / DWELL_DURATION, 1);
    drawDwellRing()

    if (dwellProgress >= 1) {
        dwellStartTime = null;
        transitionTo(STATES.ACTIVATION);
    }
}

/**
 * Handles state transition
 * @param newState
 */
function transitionTo(newState) {
    currentState = newState;
    dwellProgress = 0;
}

/**
 * exports current state
 * @returns {string}
 */
export function getCurrentState() {
    return currentState;
}

/**
 * draws dwell ring that appears if user is not interacting with the menu
 */
export function drawDwellRing() {
    if (dwellProgress <= 0) return;

    const radius = 30;
    const lineWidth = 6;
    const margin = 20;

    const x = canvas.width - margin - radius;
    const y = margin + radius;

    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + dwellProgress * Math.PI * 2;

    ctx.strokeStyle = "rgba(0, 150, 255, 0.9)";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();
}

/**
 * This function draws the hand icon. If a hand is detected, the opacity is 1, otherwise 0.5
 * @param handDetected
 */
export function drawGestureIcon(handDetected) {
    if (!handIcon.complete) return;

    const radius = 30;
    const margin = 20;

    const centerX = canvas.width - margin - radius;
    const centerY = margin + radius;

    const iconSize = 30; // Größe des Icons

    ctx.save();

    // white background
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fill();

    // depends on hand detection
    ctx.globalAlpha = handDetected ? 1.0 : 0.5;

    ctx.drawImage(
        getGestureIcon(handDetected),
        centerX - iconSize / 2,
        centerY - iconSize / 2,
        iconSize,
        iconSize
    );

    ctx.restore();
}

/**
 * Method that returns which icon has to be displayed in the dwell circle
 * @param handDetected
 * @returns {HTMLImageElement}
 */
function getGestureIcon(handDetected) {
    if(!handDetected) return handIcon;
    if (isPinched) return pinchIcon;
    if (isGrabbing) return grabIcon;
    return handIcon;
}

/**
 * calculates if hand was not detected for 0.5s
 * -> prevents that menu closes if no hand was detected in single frames to make application and detection more stable
 * @param handDetected
 * @param now
 * @returns {boolean}
 */
export function resetMenu(handDetected, now){
    if(handDetected){
        lastHandSeenTime = now;
        return false;
    } else {
        const timeSinceLastHand = now - lastHandSeenTime;
        return timeSinceLastHand > HAND_LOST_TIMEOUT;
    }
}