import { ctx } from "./main.js";
import { menu } from "./menu.js";
import { isPinched, updateIsPinched } from "./gestures.js";
import { getCursorDistance } from "./cursor.js";

let sliderConfig = null;
let sliderValue = 0.5;  // 0..1
let sliderX, sliderY, sliderWidth, sliderHeight;
export let sliderVisible = false;
export let sliderFaded = false;

// positions for tracking movement while pinched
let lastHandPositionX = null;
let lastHandPositionY = null;

// load image
const handImg = new Image();

export function drawSliderCanvas() {
    if (!sliderConfig || !sliderVisible) return;

    if (sliderFaded) ctx.globalAlpha = 0.5;

    // determines from sliderConfig if the orientation should be vertical (volume, brightness) or horizontal (vibration)
    if (sliderConfig.orientation === "vertical") {
        drawVerticalSlider();
    } else {
        drawHorizontalSlider();
    }
    ctx.globalAlpha = 1;
}

function drawVerticalSlider() {
    // background
    ctx.fillStyle = "rgba(255, 180, 120, 0.25)";
    ctx.fillRect(sliderX, sliderY, sliderWidth, sliderHeight);

    // bar chart for slider
    const filledHeight = sliderHeight * sliderValue;
    ctx.fillStyle = "rgba(255, 100, 0, 0.8)";
    ctx.fillRect(
        sliderX,
        sliderY + sliderHeight - filledHeight,
        sliderWidth,
        filledHeight
    );

    // title
    ctx.fillStyle = "black";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sliderConfig.title, sliderX + sliderWidth/2, sliderY - 30);

    // value
    ctx.fillText(Math.round(sliderValue * 100) + "%", sliderX + sliderWidth/2, sliderY + sliderHeight + 30);

    // hand-symbol
    if (handImg.complete) {
        ctx.drawImage(handImg, sliderX + 70, sliderY + sliderHeight/2 - 120/2, 80, 120);
    }
}

function drawHorizontalSlider() {
    // background
    ctx.fillStyle = "rgba(255, 180, 120, 0.25)";
    ctx.fillRect(sliderX, sliderY, sliderWidth, sliderHeight);

    // bar chart for slider
    const filledHeight = sliderWidth * sliderValue;
    ctx.fillStyle = "rgba(255, 100, 0, 0.8)";
    ctx.fillRect(
        sliderX,
        sliderY,
        filledHeight,
        sliderHeight
    );

    // title
    ctx.fillStyle = "black";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sliderConfig.title, sliderX + sliderWidth/2, sliderY - 20);

    // value
    ctx.fillText(Math.round(sliderValue * 100) + "%", sliderX + sliderWidth/2, sliderY + sliderHeight + 40);

    // hand-symbol
    if (handImg.complete) {
        // ...(handImg, space left to image, space above image, width, height);
        ctx.drawImage(handImg, sliderX + sliderWidth/2 - 60, sliderY + sliderHeight + 10, 120, 120);
    }
}

export function showSlider(type) {
    sliderVisible = true;

    // takes type of slider and builds config from it to determine which title, orientation and position the slider has to have
    sliderConfig = {
        title: {
            volume: "Lautstärke",
            brightness: "Helligkeit",
            vibration: "Vibration"
        }[type],

        orientation: {
            volume: "vertical",
            brightness: "vertical",
            vibration: "horizontal"
        }[type],

        position: {
            volume: "right",
            brightness: "left",
            vibration: "bottom"
        }[type]
    };

    // set slider width and height depending on orientation
    if (sliderConfig.orientation === "vertical") {
        sliderWidth = 20;
        sliderHeight = 250;
        handImg.src = "./images/vertical_slider_instruction.png";
    } else {
        sliderWidth = 250;
        sliderHeight = 20;
        handImg.src = "./images/horizontal_slider_instruction.png";
    }

    // calculate position relative to the menu
    switch (sliderConfig.position) {
        case "right":
            sliderX = menu.x + menu["radius"] + 160;
            sliderY = menu.y - sliderHeight / 2;
            break;

        case "left":
            sliderX = menu.x - menu["radius"] - sliderWidth - 160;
            sliderY = menu.y - sliderHeight / 2;
            break;

        case "bottom":
            sliderX = menu.x - sliderWidth / 2;
            sliderY = menu.y + menu["radius"] + 130;
            break;
    }
}

// modify slider by pinching and dragging in a certain direction
export function updateSliderValueFromHand(results) {
    // only accept modification if slider is visible and hand is pinched
    if (!isPinched) {
        lastHandPositionX = null;
        lastHandPositionY = null;
        return;
    }

    const indexTip = results.multiHandLandmarks[0][8];   // steering point

    // initialize
    if (lastHandPositionX === null || lastHandPositionY === null) {
        lastHandPositionX = indexTip.x;
        lastHandPositionY = indexTip.y;
        return;
    }

    // calculate movement (negative, because y grows downwards)
    const dx = lastHandPositionX - indexTip.x;
    const dy = lastHandPositionY - indexTip.y;

    lastHandPositionX = indexTip.x;
    lastHandPositionY = indexTip.y;

    // speed/sensitivity
    const speed = 2.0;

    if (sliderConfig.orientation === "vertical") {
        sliderValue += dy * speed;
    } else {
        sliderValue += dx * speed;
    }

    // limit values
    sliderValue = Math.min(1, Math.max(0, sliderValue));
}

// updates if curosr is in menu or in slider if slider is opened
export function updateSliderFaded() {
    if (!sliderVisible) {
        sliderFaded = false;
        return;
    }

    // cursor back in menu?
    if (getCursorDistance() < menu["radius"] + 60 && !isPinched) {
        sliderFaded = true;
    } else {
        sliderFaded = false;
    }
}

export function hideSlider() {
    sliderVisible = false;
}

// updates slider faded state, AND if slider is visible: updates pinch state + update slider value
export function updateSlider(results){
    updateSliderFaded();

    if (sliderVisible && !sliderFaded) {
        updateIsPinched(results);
        updateSliderValueFromHand(results);
    }

}