import { ctx } from "./main.js";
import {sliderVisible} from "./slider.js";

export let cursor = {
    x: 0,
    y: 0,
    visible: false,
};

// uses palm center to map cursor to its position
export function updateCursor(results){
    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[9];              // position of cursor steered by middle of hand

    cursor.x = (1 - indexTip.x) * canvas.width; // mirrored
    cursor.y = indexTip.y * canvas.height;
    cursor.visible = true;

    drawCursor(cursor.x, cursor.y);
}

function drawCursor(x, y) {
    if (sliderVisible) ctx.globalAlpha = 0.5;

    ctx.fillStyle = "purple";
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

// calculates distance from menu to cursor
export function getCursorDistance(menu, cursor) {
    const dx = cursor.x - menu.x;
    const dy = cursor.y - menu.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// draw a vector from menu center to cursor and get the angle of it to determine which segment the cursor is hovering on
export function getCursorAngle(menu, cursor) {
    const dx = cursor.x - menu.x;
    const dy = cursor.y - menu.y;

    let angle = Math.atan2(dy, dx); // -PI .. PI

    if (angle < 0) {
        angle += Math.PI * 2;       // 0 .. 2PI
    }

    return angle;
}