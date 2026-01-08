import {ctx} from "./main.js";

let idleStartTime = null;       // saves start time of idle timer
let dwellStartTime = null;      // saves start time of dwell timer
export let dwellProgress = 0;          // 0..1
const IDLE_BEFORE_DWELL = 10000; // systems waits this time if no hand was recognized -> after this time dwell timer is started
const DWELL_DURATION = 3000;    // time for the dwell timer

/**
 * Methods that handles dwell and idle state actions
 * - resets timers if hands are detected
 * - determines if dwell timer visualization has to start
 *
 * @param handDetected
 * @param now
 */
export function handleDwellAndIdle(handDetected, now){
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
 * @param progress
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