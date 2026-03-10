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
let sliderX, sliderY, sliderAreaWidth, sliderAreaHeight;
const SLIDER_GAP_BASE = 80;          // minimal distance between menu and slider
const SLIDER_GAP_PER_LEVEL = 20;     // additional spacing per active submenu depth

// values to limit messages sent each frame (time based throttling)
let lastSliderSendTime = 0;
const SLIDER_SEND_INTERVAL = 33; // ms = 30Hz (max. ca. 30 messages per second)

const VERTICAL_SLIDER_LAYOUT = {
    panelWidth: 320,
    panelHeight: 560,
    borderRadius: 10,

    titleTop: 40,
    titleLineHeight: 32,

    trackX: 92,
    trackY: 125,
    trackWidth: 22,
    trackHeight: 360,

    fillWidth: 22,

    valueBottomOffset: 30,
    currentTimeOffsetX: 10,
    totalTimeBottomOffset: 30,

    handWidth: 100,
    handHeight: 260,
    handOffsetX: 150,
    handOffsetY: 160
};

const HORIZONTAL_SLIDER_LAYOUT = {
    panelWidth: 720,
    panelHeight: 360,
    borderRadius: 10,

    titleTop: 50,

    instructionWidth: 380,
    instructionHeight: 130,
    instructionOffsetX: 170,
    instructionOffsetY: 105,

    trackX: 120,
    trackY: 245,
    trackWidth: 480,
    trackHeight: 26,

    valueTopOffset: 55,
    totalValueOffsetX: 35
};

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
    const layout = VERTICAL_SLIDER_LAYOUT;
    const progress = getSliderValue();

    // rectangle position
    const panelX = sliderX;
    const panelY = sliderY;

    // rectangle background
    ctx.save();
    drawRoundedRect(panelX, panelY, layout.panelWidth, layout.panelHeight, layout.borderRadius);
    ctx.fillStyle = "rgba(235, 235, 235, 0.7)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.stroke();
    ctx.restore();

    // "empty" bar chart for slider
    const trackX = panelX + layout.trackX;
    const trackY = panelY + layout.trackY;
    const trackWidth = layout.trackWidth;
    const trackHeight = layout.trackHeight;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(trackX, trackY, trackWidth, trackHeight);

    // progress bar chart for slider
    const fillHeight = trackHeight * progress;
    const fillX = trackX + (trackWidth - layout.fillWidth) / 2;
    const fillY = trackY + trackHeight - fillHeight;
    ctx.fillStyle = "rgba(255, 120, 70, 0.9)";
    ctx.fillRect(fillX, fillY, layout.fillWidth, fillHeight);

    // title
    ctx.fillStyle = "black";
    ctx.font = "24px RobotoCondensed";
    ctx.textAlign = "center";

    if (type === "presentation") {
        ctx.fillText("Wiedergabe", panelX + layout.panelWidth / 2, panelY + layout.titleTop);
        ctx.fillText(
            "vor-/zurückspulen",
            panelX + layout.panelWidth / 2,
            panelY + layout.titleTop + layout.titleLineHeight
        );
    } else {
        ctx.fillText(
            sliderConfig.title,
            panelX + layout.panelWidth / 2,
            panelY + layout.titleTop + 16
        );
    }

    // type-specific labels
    if (type === "presentation") {
        drawPresentationVerticalInfo(trackX, trackY, trackWidth, trackHeight, fillY, layout);
    } else {
        // draw percentage
        ctx.fillStyle = "black";
        ctx.font = "24px RobotoCondensed";
        ctx.textAlign = "center";

        ctx.fillText(
            Math.round(progress * 100) + "%",
            trackX + trackWidth / 2,
            trackY + trackHeight + layout.valueBottomOffset
        );
    }

    // hand image / instructions
    if (handImg.complete) {
        const imageX = panelX + layout.handOffsetX;
        const imageY = panelY + layout.handOffsetY;
        ctx.drawImage(handImg, imageX, imageY, layout.handWidth, layout.handHeight);
    }
}

function drawPresentationVerticalInfo(trackX, trackY, trackWidth, trackHeight, fillY, layout) {
    ctx.fillStyle = "black";
    ctx.font = "24px RobotoCondensed";

    // draw current time stamp next to progress fill
    ctx.textAlign = "right";
    ctx.fillText(
        formatMinutes(sliderValueStorage.currentLength),
        trackX - layout.currentTimeOffsetX,
        fillY
    );

    // draw total time at the bottom of the slider
    ctx.textAlign = "center";
    ctx.fillText(
        formatMinutes(sliderValueStorage.videoLength),
        trackX + trackWidth / 2,
        trackY + trackHeight + layout.totalTimeBottomOffset
    );
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
    const layout = HORIZONTAL_SLIDER_LAYOUT;
    const progress = getSliderValue();

    const panelX = sliderX;
    const panelY = sliderY;

    // panel background
    ctx.save();
    drawRoundedRect(panelX, panelY, layout.panelWidth, layout.panelHeight, layout.borderRadius);
    ctx.fillStyle = "rgba(235, 235, 235, 0.7)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.stroke();
    ctx.restore();

    // title
    ctx.fillStyle = "black";
    ctx.font = "24px RobotoCondensed";
    ctx.textAlign = "center";

    if (type === "presentation") {
        ctx.fillText(
            "Wiedergabe vor-/zurückspulen",
            panelX + layout.panelWidth / 2,
            panelY + layout.titleTop
        );
    } else {
        ctx.fillText(
            sliderConfig.title,
            panelX + layout.panelWidth / 2,
            panelY + layout.titleTop
        );
    }

    // instruction image (hand + arrows)
    if (handImg.complete) {
        ctx.drawImage(
            handImg,
            panelX + layout.instructionOffsetX,
            panelY + layout.instructionOffsetY,
            layout.instructionWidth,
            layout.instructionHeight
        );
    }

    // empty slider track
    const trackX = panelX + layout.trackX;
    const trackY = panelY + layout.trackY;
    const trackWidth = layout.trackWidth;
    const trackHeight = layout.trackHeight;

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(trackX, trackY, trackWidth, trackHeight);

    // progress fill
    const fillWidth = trackWidth * progress;
    ctx.fillStyle = "rgba(255, 120, 70, 0.9)";
    ctx.fillRect(trackX, trackY, fillWidth, trackHeight);

    // type-specific labels
    if (type === "presentation") {
        drawPresentationHorizontalInfo(trackX, trackY, trackWidth, fillWidth, layout);
    } else {
        drawDefaultHorizontalInfo(trackX, trackY, trackWidth, layout, progress);
    }
}

function drawDefaultHorizontalInfo(trackX, trackY, trackWidth, layout, progress) {
    ctx.fillStyle = "black";
    ctx.font = "24px RobotoCondensed";
    ctx.textAlign = "center";

    ctx.fillText(
        Math.round(progress * 100) + "%",
        trackX + trackWidth / 2,
        trackY + layout.valueTopOffset
    );
}

function drawPresentationHorizontalInfo(trackX, trackY, trackWidth, fillWidth, layout) {
    ctx.fillStyle = "black";
    ctx.font = "24px RobotoCondensed";

    // current time below current fill position
    ctx.textAlign = "center";
    ctx.fillText(
        formatMinutes(sliderValueStorage.currentLength),
        trackX + fillWidth,
        trackY + layout.valueTopOffset
    );

    // total duration on right side of the track
    ctx.textAlign = "left";
    ctx.fillText(
        formatMinutes(sliderValueStorage.videoLength),
        trackX + trackWidth + layout.totalValueOffsetX,
        trackY + 10
    );
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
        sliderAreaWidth = VERTICAL_SLIDER_LAYOUT.panelWidth;
        sliderAreaHeight = VERTICAL_SLIDER_LAYOUT.panelHeight;
        handImg.src = "./images/vertical_slider_instruction.png";
    } else {
        sliderAreaWidth = HORIZONTAL_SLIDER_LAYOUT.panelWidth;
        sliderAreaHeight = HORIZONTAL_SLIDER_LAYOUT.panelHeight;
        handImg.src = "./images/horizontal_slider_instruction.png";
    }

    const deepestLevel = getDeepestActiveLevel() + 1;
    const outerMenuRadius = menu.radius + deepestLevel * menu.subRadius; // radius of currently visible outer menu edge
    const sliderGap = SLIDER_GAP_BASE + deepestLevel * SLIDER_GAP_PER_LEVEL;

    // calculate position relative to the menu
    switch (sliderConfig.position) {
        case "right":
            sliderX = menuPosition.x + outerMenuRadius + sliderGap;
            sliderY = menuPosition.y - sliderAreaHeight / 2;
            break;

        case "left":
            sliderX = menuPosition.x - outerMenuRadius - sliderAreaWidth - sliderGap;
            sliderY = menuPosition.y - sliderAreaHeight / 2;
            break;

        case "bottom":
            sliderX = menuPosition.x - sliderAreaWidth / 2;
            sliderY = menuPosition.y + outerMenuRadius + sliderGap;
            break;

        case "top":
            sliderX = menuPosition.x - sliderAreaWidth / 2;
            sliderY = menuPosition.y - outerMenuRadius - sliderAreaHeight - sliderGap;
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

function drawRoundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}