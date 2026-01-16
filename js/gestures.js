export let isPinched;
export let isGrabbing = false;
export let isOpenHand = false;

/** Detects if pinch gesture is used
 * - since pinch is not a gesture that mediapipe detects by itself, this was used to detect a pinch gesture:
 *   https://medium.com/@c-damien/practical-gesture-detection-with-mediapipe-in-your-browser-283c7c1f09f0
 *
 * @param results
 */
export function updateIsPinched (results) {
    // if distance between index finger tip & thumb tip< 0.05: pinch
    const thumbTip = results.multiHandLandmarks[0][4]; const indexTip = results.multiHandLandmarks[0][8];
    const distance = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2) + Math.pow(thumbTip.z - indexTip.z, 2));

    isPinched = distance < 0.05;
}

/** Detects if grab gesture is used
 * - calculates grab using distance from fingertips to palm
 * @param results
 * @param handDetected
 */
export function updateIsGrabbing(results, handDetected) {

    if(!handDetected){
        isGrabbing = false;
        return;
    }

    const hand = results.multiHandLandmarks[0];
    const wrist = hand[0];

    // Finger tips
    const fingerTips = [
        hand[8],   // index
        hand[12],  // middle
        hand[16],  // ring
        hand[20]   // pinky
    ];

    // average distance of finger tips to palm
    let sumDistance = 0;

    for (const tip of fingerTips) {
        const d = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) +
            Math.pow(tip.y - wrist.y, 2) +
            Math.pow(tip.z - wrist.z, 2)
        );
        sumDistance += d;
    }

    const avgDistance = sumDistance / fingerTips.length;

    // grab = all fingers near palm
    isGrabbing = avgDistance < 0.10;
}

/** Detects if an open palm gesture is used
 * - calculates open palm using distance from fingertips to palm
 * @param results
 * @param handDetected
 */
export function updateIsOpenHand(results, handDetected) {
    if (!handDetected) {
        isOpenHand = false;
        return;
    }

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

    const avgDistance = sumDistance / fingerTips.length;
    const fingersExtended = avgDistance > 0.3;

    // Open hand = finger extended + no grab + no pinch
    isOpenHand = fingersExtended && !isGrabbing && !isPinched;
}
