import {ctx} from "./main.js";
import {drawGestureIcon} from "./timings.js";
export let isPinched;
export let isGrabbing = false;
export let isOpenHand = false;

/**
 * Thresholds are saved to debug correct thresholds depending on distances
 * @type {{pinchThreshold: number, openPalmThreshold: number, grabThreshold: number}}
 */
export const DEFAULT_GESTURE_THRESHOLDS = {
    pinchThreshold: 0.05,
    openPalmThreshold: 0.3,
    grabThreshold: 0.13
};

export let gestureThresholds = {
    pinchThreshold: DEFAULT_GESTURE_THRESHOLDS.pinchThreshold,
    openPalmThreshold: DEFAULT_GESTURE_THRESHOLDS.openPalmThreshold,
    grabThreshold: DEFAULT_GESTURE_THRESHOLDS.grabThreshold
}

/**
 * Load images for skip dwell time animation
 * @type {number}
 */
let grabAnimFrame = 0;
const grabFrames = [];
for (let i = 0; i <= 1; i++) {
    const img = new Image();
    img.src = `./images/grab_hint/frame_${i}.png`;
    grabFrames.push(img);
}
const grabInfoIcon = new Image();
grabInfoIcon.src = "./images/grab_hint/info.png";

/**
 * general function to detect gestures
 * @param results
 * @param handDetected
 */
export function updateGestures(results, handDetected){
    updateIsOpenHand(results, handDetected)
    updateIsPinched(results, handDetected)
    updateIsGrabbing(results, handDetected)
    drawGestureIcon(handDetected);     // draw hand Icon
}

/** Detects if pinch gesture is used
 * - since pinch is not a gesture that mediapipe detects by itself, this was used to detect a pinch gesture:
 *   https://medium.com/@c-damien/practical-gesture-detection-with-mediapipe-in-your-browser-283c7c1f09f0
 *
 * @param results
 * @param handDetected
 */
function updateIsPinched (results, handDetected) {
    if(!handDetected){
        isPinched = false;
        return;
    }

    // if distance between index finger tip & thumb tip< 0.05: pinch
    const thumbTip = results.multiHandLandmarks[0][4]; const indexTip = results.multiHandLandmarks[0][8];
    const distance = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2) + Math.pow(thumbTip.z - indexTip.z, 2));

    isPinched = distance < gestureThresholds.pinchThreshold;
}

/** Detects if grab gesture is used
 * - calculates grab using distance from fingertips to palm
 * @param results
 * @param handDetected
 */
function updateIsGrabbing(results, handDetected) {
    if(!handDetected){
        isGrabbing = false;
        return;
    }

    const avgDistance = calculateAvgFingerDistance(results);

    // grab = all fingers near palm
    isGrabbing = avgDistance < gestureThresholds.grabThreshold;
}

/** Detects if an open palm gesture is used
 * - calculates open palm using distance from fingertips to palm
 * @param results
 * @param handDetected
 */
function updateIsOpenHand(results, handDetected) {
    if (!handDetected) {
        isOpenHand = false;
        return;
    }

    const avgDistance = calculateAvgFingerDistance(results);
    const hand = results.multiHandLandmarks[0];
    const thumbToPinkyDistanceX = Math.abs(hand[4].x - hand[20].x) + gestureThresholds.openPalmThreshold*0.67; // additional offset so that we can use the same threshold for both open palm distances, but since pinky and thumb have a smaller distance than fingertips and palm button, we need to add an offset.

    const fingersExtended = avgDistance > gestureThresholds.openPalmThreshold;
    const frontalCheck = thumbToPinkyDistanceX > gestureThresholds.openPalmThreshold;

    // Open hand = finger extended + frontal palm + no grab + no pinch
    isOpenHand = fingersExtended && frontalCheck && !isGrabbing && !isPinched;
}

/**
 * Helper function to calculate the average distance of the fingers to the palm
 * @param results
 * @returns {number}
 */
function calculateAvgFingerDistance(results){
    const hand = results.multiHandLandmarks[0];
    const wrist = hand[0];

    // Finger tips
    const fingerTips = [
        hand[8],   // index
        hand[12],  // middle
        hand[16],  // ring
        hand[20]   // pinky
    ];

    let sumDistance = 0;

    for (const tip of fingerTips) {
        const d = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) +
            Math.pow(tip.y - wrist.y, 2) +
            Math.pow(tip.z - wrist.z, 2)
        );
        sumDistance += d;
    }

    return sumDistance / fingerTips.length;
}

/** Method that draws hint for grab gesture to skip dwell time
 *
 * @param x
 * @param y
 */
export function drawGrabHint(x, y) {
    const frame = grabFrames[Math.floor(grabAnimFrame) % grabFrames.length];
    if (!frame?.complete) return;

    const panelWidth = 250;
    const panelHeight = 50;
    const panelStartX = x - panelWidth / 2;
    const panelStartY = y - panelHeight / 2;
    const panelRadius = 10;

    // background panel
    drawRoundedRect(panelStartX, panelStartY, panelWidth, panelHeight, panelRadius);
    ctx.fillStyle = "rgba(45, 140, 255, 0.7)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(45, 140, 255, 1)";
    ctx.stroke();

    // info icon on the left
    const infoSize = 30;
    const infoX = panelStartX + 8;
    const infoY = panelStartY + (panelHeight - infoSize) / 2;
    if (grabInfoIcon.complete) {
        ctx.drawImage(grabInfoIcon, infoX, infoY, infoSize, infoSize);
    }

    // label text
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.font = "22px RobotoCondensed";
    ctx.fillText("Skip dwell time", panelStartX + 112, panelStartY + panelHeight / 2 + 2);

    // animated hand icon on the right
    const handSize = 32;
    const handX = panelStartX + panelWidth - handSize - 12;
    const handY = panelStartY + (panelHeight - handSize) / 2;
    ctx.drawImage(frame, handX, handY, handSize, handSize);

    grabAnimFrame += 0.05; // speed
}

function drawRoundedRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
