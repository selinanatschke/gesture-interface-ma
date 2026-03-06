import { ctx } from "./main.js";
import {
    getDeepestActiveLevel,
    getHoveredItem,
    getSliderPlacementForMainItem,
    interactionState,
    menu,
    menuPosition,
    stateItemIsSet
} from "./menu.js";
import { isPinched } from "./gestures.js";
import { getCurrentState, STATES } from "./timings.js";
import { sendMessage } from "./websocket.js";
import { sliderValueStorage } from "./data.js";

let sliderConfig = null;
let sliderValue;        // local slider value
let sliderX, sliderY, sliderWidth, sliderHeight;
const SLIDER_GAP_BASE = 80;          // minimal distance between menu and slider
const SLIDER_GAP_PER_LEVEL = 20;     // additional spacing per active submenu depth

// values to limit messages sent each frame (time based throttling)
let lastSliderSendTime = 0;
const SLIDER_SEND_INTERVAL = 33; // ms = 30Hz (max. ca. 30 messages per second)

/**
 * This determines whether the user currently interacts with the menu or with the slider
 * @type {{MENU: string, SLIDER: string}}
 */
export const UI_STATES = {
    MENU: "menu",
    SLIDER: "slider"
};
let currentUiState = UI_STATES.MENU;

export function setCurrentUiState(newState) {
    currentUiState = newState;
}

export function getCurrentUiState() {
    return currentUiState;
}

export const sliderState = {
    visible: false,                 // determines whether slider is drawn or not (true if preview or active)
    previewOwner: null,
    selectedSliderType: null,
    selectedSliderId: null
};

// positions for tracking movement while pinched
let lastHandPositionX = null;
let lastHandPositionY = null;

// load image
const handImg = new Image();

// play button image
const playIcon = new Image();
playIcon.src = "./images/play_icon.png";

const SLIDER_META = {
    volume: {
        title: "Lautstärke"
    },
    brightness: {
        title: "Helligkeit"
    },
    vibration: {
        title: "Vibration"
    },
    presentation: {
        title: "Wiedergabe vor-/zurückspulen"
    }
};

export function openSelectedSlider(selectedSliderType, selectedSliderId){
    sliderState.selectedSliderType = selectedSliderType;
    sliderState.selectedSliderId = selectedSliderId
    sliderState.visible = true;
    sliderState.previewOwner = null;
    setCurrentUiState(UI_STATES.SLIDER);
}

/**
 * Determines whether the slider has to be drawn horizontally or vertically depending on its type
 */
export function drawSliderCanvas() {
    if (!sliderConfig || !sliderState.visible) return;

    if (!!sliderState.previewOwner || getCurrentState() === STATES.DWELL) ctx.globalAlpha = 0.5;

    // determines from sliderConfig if the orientation should be vertical (volume, brightness) or horizontal (vibration)
    if (sliderConfig.orientation === "vertical") {
        drawVerticalSlider(sliderConfig.type);
    } else {
        drawHorizontalSlider(sliderConfig.type);
    }
    ctx.globalAlpha = 1;
}

/**
 * Draws slider vertically
 */
function drawVerticalSlider(type) {
    // background
    ctx.fillStyle = "rgba(255, 180, 120, 0.25)";
    ctx.fillRect(sliderX, sliderY, sliderWidth, sliderHeight);

    // bar chart for slider
    const filledHeight = sliderHeight * getSliderValue();
    ctx.fillStyle = "rgba(255, 100, 0, 0.8)";
    ctx.fillRect(
        sliderX,
        sliderY + sliderHeight - filledHeight,
        sliderWidth,
        filledHeight
    );

    // title
    ctx.fillStyle = "black";
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sliderConfig.title, sliderX + sliderWidth/2, sliderY - 30);

    // if type is not presentation, use normal layout
    if (type !== "presentation") {
        ctx.fillText(Math.round(getSliderValue() * 100) + "%", sliderX + sliderWidth/2, sliderY + sliderHeight + 30);
    } else {
        renderPresentationSliderExtras(filledHeight, "vertical")
    }

    // hand-symbol
    if (handImg.complete) {
        ctx.drawImage(handImg, sliderX + 70, sliderY + sliderHeight/2 - 120/2, 100, 180);
    }
}

/**
 * Closes the preview if hover does not match owner
 * @param level
 */
export function handlePreview(level){
    if (!!sliderState.previewOwner) {
        const stillHovered = isPreviewOwnerStillHovered(sliderState.previewOwner);

        if (!stillHovered) {
            hideSlider();
            sliderState.previewOwner = null;
        }
    }

    // slider preview if hover but not confirmed yet
    if (interactionState.levels[level].dwellProgress > 0 && interactionState.levels[level].dwellProgress < 1) {
        const hoveredItem = getHoveredItem(level)
        const owner = buildPreviewOwner(level);

        if (hoveredItem?.type === "slider" && !sliderState.previewOwner) {
            showSliderPreview(hoveredItem.target, owner, hoveredItem.id);
        }
    }
}

/**
 * Helper function to get preview owner data
 * if an element of level 2 is selected, the data could look something like:
 * { level: 1, path: [0,1]} -> this means main element 0 opened child elements and child element 1 opened slider
 *
 * @param level
 * @returns {{level: *, path: *[]}}
 */
function buildPreviewOwner(level) {
    const path = [];

    for (let i = 0; i < level; i++) {
        path.push(interactionState.levels[i]?.selected);
    }
    path.push(interactionState.levels[level]?.hover);

    return { level, path };
}

/**>
 * Helper function that checks if slider owner element is still hovered
 * @param owner
 * @returns {boolean}
 */
function isPreviewOwnerStillHovered(owner) {
    if (!owner) return false;

    const ownerLevel = owner.level;

    // checks for each deeper level if the selected element is still selected
    for (let i = 0; i < ownerLevel; i++) {
        const expectedSelected = owner.path[i];
        if (!stateItemIsSet(expectedSelected) || interactionState.levels[i]?.selected !== expectedSelected) {
            return false;
        }
    }

    // checks if expected hovered element is still hovered
    const expectedHover = owner.path[ownerLevel];
    return stateItemIsSet(expectedHover) && interactionState.levels[ownerLevel]?.hover === expectedHover;
}

/**
 * Draws slider vertically
 */
function drawHorizontalSlider(type) {
    // background
    ctx.fillStyle = "rgba(255, 180, 120, 0.25)";
    ctx.fillRect(sliderX, sliderY, sliderWidth, sliderHeight);

    // bar chart for slider
    const filledWidth = sliderWidth * getSliderValue();
    ctx.fillStyle = "rgba(255, 100, 0, 0.8)";
    ctx.fillRect(
        sliderX,
        sliderY,
        filledWidth,
        sliderHeight
    );

    // title
    ctx.fillStyle = "black";
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sliderConfig.title, sliderX + sliderWidth/2, sliderY - 20);

    // if type is not presentation, use normal layout
    if (type !== "presentation") {
        ctx.fillText(Math.round(getSliderValue() * 100) + "%", sliderX + sliderWidth / 2, sliderY + sliderHeight + 20
        );
    } else {
        renderPresentationSliderExtras(filledWidth, "horizontal")
    }

    // hand-symbol with adaptive spacing
    if (handImg.complete) {
        // ...(handImg, space left to image, space above image, width, height);
        ctx.drawImage(handImg, sliderX + sliderWidth/2 - 60, sliderY + sliderHeight + 40, 140, 140);
    }
}

function renderPresentationSliderExtras(filledFormat, format){
    // if type is presentation, add video play button and minute counter
    ctx.font = "32px sans-serif";

    if (format === "horizontal") {
    // current time (moves with slider)
        ctx.textAlign = "left";
        ctx.fillText(
            formatMinutes(sliderValueStorage.currentLength),
            sliderX + filledFormat,
            sliderY + sliderHeight + 20
        );

        // total duration (static, right)
        ctx.textAlign = "right";
        ctx.fillText(
            formatMinutes(sliderValueStorage.videoLength),
            sliderX + sliderWidth,
            sliderY + sliderHeight + 20
        );

        // play icon (left of slider)
        if (playIcon.complete) {
            ctx.drawImage(
                playIcon,
                sliderX - 40,
                sliderY + sliderHeight / 2 - 16,
                32,
                32
            );
        }
    } else if (format ==="vertical"){
        // current time (moves vertically with progress)
        const currentY = sliderY + sliderHeight - filledFormat;

        ctx.textAlign = "right";
        ctx.fillText(
            formatMinutes(sliderValueStorage.currentLength),
            sliderX - 10,
            currentY + 10
        );

        // total duration (bottom, centered)
        ctx.textAlign = "center";
        ctx.fillText(
            formatMinutes(sliderValueStorage.videoLength),
            sliderX + sliderWidth / 2,
            sliderY + sliderHeight + 30
        );

        // play icon (left, center of slider)
        if (playIcon.complete) {
            ctx.drawImage(
                playIcon,
                sliderX,
                sliderY + sliderHeight + 60,
                32,
                32
            );
        }
    }
}

function formatMinutes(secondsTotal) {
    const minutes = Math.floor(secondsTotal / 60);
    const seconds = Math.floor(secondsTotal % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Creates a sliderconfig that is used to determine which orientation the slider needs to have, which images are loaded and where to position it
 *
 * @param type
 * @param id
 */
export function showSlider(type, id) {
    const meta = SLIDER_META[type];
    if (!meta) {
        console.warn("Unknown slider type:", type);
        return;
    }

    sliderState.visible = true;

    const placement = getSliderPlacementForMainItem(type, id);

    // takes type of slider and builds config from it to determine which title, orientation and position the slider has to have
    sliderConfig = {
        type: type,
        ...meta,
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

    const deepestLevel = getDeepestActiveLevel() + 1;
    const outerMenuRadius = menu.radius + deepestLevel * menu.subRadius; // radius of currently visible outer menu edge
    const sliderGap = SLIDER_GAP_BASE + deepestLevel * SLIDER_GAP_PER_LEVEL;

    // calculate position relative to the menu
    switch (sliderConfig.position) {
        case "right":
            sliderX = menuPosition.x + outerMenuRadius + sliderGap;
            sliderY = menuPosition.y - sliderHeight / 2;
            break;

        case "left":
            sliderX = menuPosition.x - outerMenuRadius - sliderWidth - sliderGap - 80;
            sliderY = menuPosition.y - sliderHeight / 2;
            break;

        case "bottom":
            sliderX = menuPosition.x - sliderWidth / 2;
            sliderY = menuPosition.y + outerMenuRadius + sliderGap;
            break;

        case "top":
            sliderX = menuPosition.x - sliderWidth / 2;
            sliderY = menuPosition.y - outerMenuRadius - sliderHeight - sliderGap - 80;
            break;
    }
    syncSliderFromData(type, id);
}

/** Copies values from data.js in sliderValue
 * @param type
 * @param id
 */
export function syncSliderFromData(type, id) {
    if (type === "presentation") {
        sliderValue = sliderValueStorage.currentLength/sliderValueStorage.videoLength;
        return;
    }

    const actionItem = sliderValueStorage.actionItems?.[id];
    if (!actionItem || actionItem.target !== type) return;

    sliderValue = actionItem.value;
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

    const now = performance.now();

    if (now - lastSliderSendTime > SLIDER_SEND_INTERVAL) {
        sendMessage({
            action: "update",
            type: "slider",
            target: sliderConfig.type,
            value: sliderValue,
            id: sliderState.selectedSliderId
        });

        lastSliderSendTime = now;
    }
}

/**
 * hides the slider
 */
export function hideSlider() {
    sliderState.previewOwner = null;
    sliderState.visible = false;
    sliderState.selectedSliderType = null;
    sliderState.selectedSliderId = null;
    lastHandPositionX = null;
    lastHandPositionY = null;
}

/**
 * activates slider manipulation is slider ui mode is active
 * @param results
 */
export function updateSlider(results) {
    if(!sliderState.selectedSliderType && !sliderState.previewOwner) return;

    // if slider is visible -> wait for gesture and modify values
    if (sliderState.visible && currentUiState === UI_STATES.SLIDER) {
        updateSliderValueFromHand(results);
    }

    // if an item with a slider action was already opened and no other slider preview is shown currently, draw slider
    if(sliderState.selectedSliderType && !sliderState.previewOwner && !sliderState.visible){
        showSlider(sliderState.selectedSliderType, sliderState.selectedSliderId);    // enables slider
    }
}

/**
 * Enables slider preview
 * @param type
 * @param owner
 * @param id
 */
export function showSliderPreview(type, owner, id) {
    if (!type) return;

    sliderState.selectedSliderType = type;
    sliderState.selectedSliderId = id;

    showSlider(type, id);
    setCurrentUiState(UI_STATES.MENU)
    sliderState.previewOwner = owner
}

/**
 * Method that returns slider value for the correct slider type.
 * @returns {*|number}
 */
function getSliderValue() {
    if (!sliderConfig) return 0;

    if(currentUiState === UI_STATES.SLIDER && isPinched){
        return sliderValue;
    }

    if (sliderConfig.type === "presentation") {
        return sliderValueStorage.videoLength
            ? sliderValueStorage.currentLength / sliderValueStorage.videoLength
            : 0;
    }

    const id = sliderState.selectedSliderId;
    const entry = id != null ? sliderValueStorage.actionItems?.[id] : null;
    return entry && entry.target === sliderConfig.type ? entry.value : 0;
}

