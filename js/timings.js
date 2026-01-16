import {ctx} from "./main.js";
import { isOpenHand } from "./gestures.js";

// idle dwell for no interaction
let idleStartTime = null;       // saves start time of idle timer
let dwellStartTime = null;      // saves start time of dwell timer
export let dwellProgress = 0;          // 0..1
const IDLE_BEFORE_DWELL = 10000; // systems waits this time if no hand was recognized -> after this time dwell timer is started
const DWELL_DURATION = 3000;    // time for the dwell timer

// activation dwell
export let menuUnlocked = false;
let activationStartTime = null;
const ACTIVATION_DURATION = 3000; // 3s Freischalt-Dwell

// hand icon
const handIcon = new Image();
handIcon.src = "./images/hand.png";

/**
 * Methods that handles dwell and idle state actions
 * - resets timers if hands are detected
 * - determines if dwell timer visualization has to start
 *
 * @param handDetected
 * @param now
 */
export function handleDwellAndIdle(handDetected, now){

    // activation dwell
    if (!menuUnlocked) {
        handleActivationDwell(handDetected, now);
        return;
    }

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
}

/**
 * method that handles activation time to open menu
 * @param handDetected
 * @param now
 */
function handleActivationDwell(handDetected, now) {

    if (!handDetected || !isOpenHand) {
        activationStartTime = null;
        dwellProgress = 0;
        return;
    }

    if (activationStartTime === null) {
        activationStartTime = now;
    }

    const elapsed = now - activationStartTime;
    dwellProgress = Math.min(elapsed / ACTIVATION_DURATION, 1);

    drawDwellRing();

    if (dwellProgress >= 1) {
        menuUnlocked = true;
        activationStartTime = null;
        dwellProgress = 0;
        resetTimers();
    }
}

/**
 * resets timers if hand was recognized
 */
export function resetTimers(){
    idleStartTime = null;
    dwellStartTime = null;
    dwellProgress = 0;
}

/**
 * If hand is not detected and no idle is already running -> starts idle timer
 * @param handDetected
 * @param now
 * @returns {boolean}
 */
export function updateIdle(handDetected, now) {
    if (idleStartTime === null && !handDetected) {
        idleStartTime = now;
        return false;
    }

    return !handDetected && now - idleStartTime >= IDLE_BEFORE_DWELL;
}

/**
 * sets dwell timer and updates dwell progress
 * @param now
 */
export function updateDwell(now) {
    if (dwellStartTime === null) {      // if no dwell timer is running, set a new one
        dwellStartTime = now;
    }

    const elapsed = now - dwellStartTime;
    dwellProgress = Math.min(elapsed / DWELL_DURATION, 1);
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

export function setMenuUnlocked(value){
    menuUnlocked = value;
}

/**
 * This function draws the hand icon. If a hand is detected, the opacity is 1, otherwise 0.5
 * @param handDetected
 */
export function drawHandIcon(handDetected) {
    if (!handIcon.complete) return;

    const radius = 30;
    const margin = 20;

    const centerX = canvas.width - margin - radius;
    const centerY = margin + radius;

    const iconSize = 30; // Größe des Icons

    ctx.save();

    // depends on hand detection
    ctx.globalAlpha = handDetected ? 1.0 : 0.5;

    ctx.drawImage(
        handIcon,
        centerX - iconSize / 2,
        centerY - iconSize / 2,
        iconSize,
        iconSize
    );

    ctx.restore();
}
