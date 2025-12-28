import {ctx} from "./main.js";

let idleStartTime = null;       // saves start time of idle timer
let dwellStartTime = null;      // saves start time of dwell timer
export let dwellProgress = 0;          // 0..1
const IDLE_BEFORE_DWELL = 5000; // systems waits this time if no hand was recognized -> after this time dwell timer is started
const DWELL_DURATION = 3000;    // time for the dwell timer

// resets timers if hand was recognized
export function resetTimers(){
    idleStartTime = null;
    dwellStartTime = null;
    dwellProgress = 0;
}

// resets all timers if no hand was detected; checks if idle state is active and returns if dwell timer should be started
export function updateIdle(handDetected, now) {
    if (idleStartTime === null && !handDetected) {
        idleStartTime = now;
        return false;
    }

    return !handDetected && now - idleStartTime >= IDLE_BEFORE_DWELL;
}

export function updateDwell(now) {
    if (dwellStartTime === null) {      // if no dwell timer is running, set a new one
        dwellStartTime = now;
    }

    const elapsed = now - dwellStartTime;
    dwellProgress = Math.min(elapsed / DWELL_DURATION, 1);
}

// function to draw dwell ring that appears if user is not interacting with the menu
export function drawDwellRing(progress) {
    if (progress <= 0) return;

    const radius = 30;
    const lineWidth = 6;
    const margin = 20;

    const x = canvas.width - margin - radius;
    const y = margin + radius;

    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + progress * Math.PI * 2;

    ctx.strokeStyle = "rgba(0, 150, 255, 0.9)";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();
}