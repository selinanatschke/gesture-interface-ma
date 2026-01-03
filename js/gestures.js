export let isPinched;

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