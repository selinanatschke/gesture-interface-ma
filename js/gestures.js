import {ctx} from "./main.js";
export let isPinched;
export let isGrabbing = false;
export let isOpenHand = false;

/**
 * Thresholds are saved to debug correct thresholds depending on distances
 * @type {{pinchThreshold: number, openPalmThreshold: number, grabThreshold: number}}
 */
export let gestureThresholds = {
    pinchThreshold: 0.05,
    openPalmThreshold: 0.3,
    grabThreshold: 0.13
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

/**
 * general function to detect gestures
 * @param results
 * @param handDetected
 */
export function updateGestures(results, handDetected){
    updateIsOpenHand(results, handDetected)
    updateIsPinched(results, handDetected)
    updateIsGrabbing(results, handDetected)
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

    const avgDistance = calculateAvgFingerDistance(results)

    const fingersExtended = avgDistance > gestureThresholds.openPalmThreshold;

    // Open hand = finger extended + no grab + no pinch
    isOpenHand = fingersExtended && !isGrabbing && !isPinched;
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

    ctx.font = "64px sans-serif";
    ctx.fillText("Skip dwell time", x-100, y-120);
    ctx.drawImage(frame, x+150, y-180, 100, 100);
    grabAnimFrame += 0.05; // speed
}