import { ctx } from "./main.js";
import { sliderState } from "./slider.js";
import { menu } from "./menu.js"

/** cursor element that holds the position of the cursor
 *
 * @type {{x: number, y: number}}
 */
export let cursor = {
    x: 0,
    y: 0,
};

/** Function that uses the palm center to map the cursor position to its position.
 *
 * @param results
 */
export function updateCursor(results){
    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[9];              // position of cursor steered by middle of hand

    cursor.x = (1 - indexTip.x) * canvas.width; // mirrored
    cursor.y = indexTip.y * canvas.height;

    drawCursor(cursor.x, cursor.y);
}

/** Draws cursor on the canvas
 *
 * @param x
 * @param y
 */
function drawCursor(x, y) {
    if (sliderState.visible) ctx.globalAlpha = 0.5;

    ctx.fillStyle = "purple";
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

/** Calculates distance from menu to cursor
 *
 * @returns {number}
 */
export function getCursorDistance() {
    const dx = cursor.x - menu.x;
    const dy = cursor.y - menu.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/** Draww a vector from menu center to cursor and gets the angle of it (to determine later which segment the cursor is hovering on)
 *
 * @returns {number}
 */
export function getCursorAngle() {
    const dx = cursor.x - menu.x;
    const dy = cursor.y - menu.y;

    let angle = Math.atan2(dy, dx); // -PI .. PI

    if (angle < 0) {
        angle += Math.PI * 2;       // 0 .. 2PI
    }

    return angle;
}