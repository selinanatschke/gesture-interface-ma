import { ctx } from "./main.js";
import {
    getHoveredItem,
    getSliderPlacementForMainItem,
    interactionState,
    itemHasSlider,
    menu
} from "./menu.js";
import { isPinched, updateIsPinched } from "./gestures.js";
import { dwellProgress } from "./timings.js";

let sliderConfig = null;
let sliderValue = 0.5;  // 0..1
let sliderX, sliderY, sliderWidth, sliderHeight;

/** State that keeps track of slider visibility
 * - visible: is slider visible?
 * - pewview: is preview active?
 * - previewOwner: item that opened the preview
 *
 * @type {{visible: boolean, preview: boolean, previewOwner: null, selectedSliderType: null}}
 */
export const sliderState = {
    visible: false,
    preview: false,
    previewOwner: null,
    selectedSliderType: null,
};

/** This determines what is visible and interactive
 *  current can be: menu, slider
 * @type {{current: string}}
 */
export const uiMode = {
    current: "menu", // || "slider"
}

// positions for tracking movement while pinched
let lastHandPositionX = null;
let lastHandPositionY = null;

// load image
const handImg = new Image();

// play button image
const playIcon = new Image();
playIcon.src = "./images/play_icon.png";

export function openSelectedSlider(selectedSliderType){
    sliderState.selectedSliderType = selectedSliderType;
}
/**
 * Determines whether the slider has to be drawn horizontally or vertically depending on its type
 */
export function drawSliderCanvas() {
    if (!sliderConfig || !sliderState.visible) return;

    if (sliderState.preview || dwellProgress > 0) ctx.globalAlpha = 0.5;

    // determines from sliderConfig if the orientation should be vertical (volume, brightness) or horizontal (vibration)
    if (sliderConfig.orientation === "vertical") {
        drawVerticalSlider();
    } else {
        drawHorizontalSlider(sliderConfig.type);
    }
    ctx.globalAlpha = 1;
}

/**
 * Draws slider vertically
 */
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

/**
 * Closes the preview if hover does not match owner
 * @param level
 */
export function handlePreview(level){
    if (sliderState.preview) {

        const stillHovered =
            (sliderState.previewOwner?.level === 0 || sliderState.previewOwner.level === "main")
                ? interactionState.main.hover === sliderState.previewOwner?.index
                : (
                    interactionState.sub.hover === sliderState.previewOwner?.sub &&
                    interactionState.main.selected === sliderState.previewOwner?.main
                );

        if (!stillHovered) {
            hideSlider();
            sliderState.preview = false;
            sliderState.previewOwner = null;
        }
    }

    // slider preview if hover but not confirmed yet
    if (interactionState[level].dwellProgress > 0 && interactionState[level].dwellProgress < 1) {
        const hoveredItem = (level === 0 || level === "main") ? getHoveredItem("main") : getHoveredItem("sub");

        const owner =
            (level === 0 || level === "main")
                ? { level: 0, index: interactionState.main.hover }
                : { level: 1, main: interactionState.main.selected, sub: interactionState.sub.hover };

        if (itemHasSlider(hoveredItem) && !sliderState.preview) {
            showSliderPreview(hoveredItem.action.type, owner);

        }
    }
}

/**
 * Draws slider vertically
 */
function drawHorizontalSlider(type) {
    // background
    ctx.fillStyle = "rgba(255, 180, 120, 0.25)";
    ctx.fillRect(sliderX, sliderY, sliderWidth, sliderHeight);

    // bar chart for slider
    const filledWidth = sliderWidth * sliderValue;
    ctx.fillStyle = "rgba(255, 100, 0, 0.8)";
    ctx.fillRect(
        sliderX,
        sliderY,
        filledWidth,
        sliderHeight
    );

    // title
    ctx.fillStyle = "black";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sliderConfig.title, sliderX + sliderWidth/2, sliderY - 20);

    // if type is not presentation, use normal layout
    if (type !== "presentation") {
        ctx.fillText(Math.round(sliderValue * 100) + "%", sliderX + sliderWidth / 2, sliderY + sliderHeight + 20
        );
    } else {
        renderPresentationSliderExtras(filledWidth)
    }

    // hand-symbol with adaptive spacing
    if (handImg.complete) {
        // ...(handImg, space left to image, space above image, width, height);
        ctx.drawImage(handImg, sliderX + sliderWidth/2 - 60, sliderY + sliderHeight + 40, 120, 120);
    }
}

function renderPresentationSliderExtras(filledWidth){
    // if type is presentation, add video play button an minute counter
    const videoLength = 12.5; // min TODO get real value (?)
    const currentLength = sliderValue * videoLength;

    ctx.font = "20px sans-serif";

    // current time (on the left, moves with slider progress)
    ctx.textAlign = "left";
    ctx.fillText(formatMinutes(currentLength), sliderX + filledWidth, sliderY + sliderHeight + 20
    );

    // total video length (on the right, static)
    ctx.textAlign = "right";
    ctx.fillText(formatMinutes(videoLength), sliderX + sliderWidth, sliderY + sliderHeight + 20);

    // play icon (links vom Slider)
    if (playIcon.complete) {
        ctx.drawImage(playIcon, sliderX - 40, sliderY + sliderHeight / 2 - 16, 32, 32);
    }
}

function formatMinutes(value) {
    const minutes = Math.floor(value);
    const seconds = Math.round((value - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Creates a sliderconfig that is used to determine which orientation the slider needs to have, which images are loaded and where to position it
 *
 * @param type
 */
export function showSlider(type) {
    sliderState.visible = true;
    sliderState.preview = false;

    const placement = getSliderPlacementForMainItem(type);

    // takes type of slider and builds config from it to determine which title, orientation and position the slider has to have
    sliderConfig = {
        type: type,
        title: {
            volume: "Lautstärke",
            brightness: "Helligkeit",
            vibration: "Vibration",
            presentation: "Wiedergabe vor-/zurückspulen"
        }[type],
        orientation: placement.orientation,
        position: placement.position
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

        case "top":
            sliderX = menu.x - sliderWidth / 2;
            sliderY = menu.y - menu["radius"] - sliderHeight - 240;
            break;
    }
}

/**
 * modifies slider values by pinching and dragging in a certain direction
 * @param results
 */
export function updateSliderValueFromHand(results) {
    if (!sliderConfig) return;

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

/**
 * hides the slider
 */
export function hideSlider() {
    sliderState.preview = false;
    sliderState.visible = false;
    sliderState.selectedSliderType = null;
    lastHandPositionX = null;
    lastHandPositionY = null;
}

/**
 * activates slider manipulation is slider ui mode is active
 * @param results
 */
export function updateSlider(results) {
    if(!sliderState.selectedSliderType && !sliderState.preview) return;

    // if slider is visible and user has navigated cursor to slider to interact -> wait for gesture and modify values
    if (sliderState.visible && uiMode.current === "slider") {
        updateIsPinched(results);
        updateSliderValueFromHand(results);
    }

    // if an item with a slider action was already opened and no other slider preview is shown currently, draw slider
    if(sliderState.selectedSliderType && !sliderState.preview){
        showSlider(sliderState.selectedSliderType);    // enables slider
    }
}

/**
 * Enables slider preview
 * @param type
 * @param owner
 */
export function showSliderPreview(type, owner) {
    if (!type) return;

    showSlider(type);
    sliderState.preview = true;
    uiMode.current = "menu"
    sliderState.previewOwner = owner
}