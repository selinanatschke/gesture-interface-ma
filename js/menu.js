import {getCurrentState, STATES} from "./timings.js";
import { ctx } from "./main.js";
import { getCursorDistance, getCursorAngle } from "./cursor.js";
import {
    getCurrentUiState,
    handlePreview,
    hideSlider,
    openSelectedSlider,
    setCurrentUiState,
    sliderState,
    UI_STATES
} from "./slider.js";
import { isGrabbing } from "./gestures.js";
import { sendMessage } from "./websocket.js";
import {sliderValueStorage} from "./data.js";

export let menu = null; // will be received from server

export function setMenu(newMenu) {
    menu = newMenu;

    // initialize interaction state based on new menu depth
    interactionState.levels = Array.from(
        { length: getMenuDepth(menu.items) },
        () => createLevelState()
    );
}

export const menuPosition = {
    x: 0,
    y: 0
};

/**
 *  Scale steps for administrating the size of the application
 * @type {{radiusStep: number, minRadius: number, maxRadius: number}}
 */
export const UI_SCALE = {
    radiusStep: 20,
    minRadius: 120,
    maxRadius: 500
};

const MENU_COLORS = {
    base: "rgba(255, 255, 255, 0.75)",
    hover: "rgba(255, 120, 255, 0.75)",
    selected: "rgba(255, 0, 255, 0.75)",
    dwell: "rgba(0, 0, 0, 0.25)",
    stroke: "rgba(0, 0, 0)"
};

/** State that saves all information about the menu levels
 * currently: two levels: main, sub (but can be expanded by doing: interactionState.levels.push(createLevelState()))
 *
 * - hover - which element in this level is currently hovered?
 * - selected - which element in this level is currently selected (=with confirmed action like dwell time)?
 * - dwellStart - start time of hover dwell
 * - dwellProgress - 0..1, shows how far hover dwell is
 * - dwellTriggered - shows if dwell is already triggered (important so that action is not done every frame)
 * - previousHover - shows which element was hovered in the last frame (important because otherwise you cannot tell if the hover switched menu items)
 */
function createLevelState() {
    return {
        hover: null,
        selected: null,
        dwellStart: null,
        dwellProgress: 0,
        dwellTriggered: false,
        previousHover: null
    };
}
export const interactionState = {
    levels: []
};

/**
 * loops recursively through children and returns max depth
 * @param items
 * @param currentDepth
 * @returns {number}
 */
function getMenuDepth(items, currentDepth = 1) {
    if (!items) return currentDepth;

    let maxDepth = currentDepth;

    for (const item of items) {
        if (item.children && item.children.length > 0) {
            const depth = getMenuDepth(item.children, currentDepth + 1);
            maxDepth = Math.max(maxDepth, depth);
        }
    }
    return maxDepth;
}

/** Determines how long hover takes
 *
 * @type {number}
 */
const HOVER_FILL_DURATION = 3000;   // ms, how fast segment fills on hover

/** Saves the previously loaded icons so that they do not have to be fetched for every frame
 *
 * @type {{}}
 */
const iconCache = {};

/** handles actions that happen when cursor hovers menu, e.g.
 * - slider preview
 * - edge case handling for main menu interaction (e.g. reset selected items if hovered items are switched)
 * - hover state resets
 * - handles selection including triggering actions or opening submenus
 * => Interaction within a level
 *
 * @param now
 * @param level : this decides if main menu or x. level (submenu) is opened
 **/
export function updateLevelInteractionState(now, level) {
    const state = interactionState.levels[level]

    // if a deeper level is active, do not calculate hover for higher levels OR for the levels that are not actively hovered
    if(level < getDeepestActiveLevel() || stateItemIsNotSet(state.hover)) return;

    handlePreview(level)

    // if a main element is selected and the slider is not active, and the main selection switches -> reset main selection
    if(stateItemIsSet(interactionState.levels[0].selected)
        && !sliderState.visible
        && interactionState.levels[0].hover !== interactionState.levels[0].previousHover
        && !isCursorInSubMenuRing()) {
        interactionState.levels[0].selected = null;
    }

    // the hover needs to be reset if either no item in the current level is hovered or if the user switched elements
    const needsReset =
        !stateItemIsSet(state.hover) ||
        state.hover !== state.previousHover;

    const progressFinished = updateDwell(needsReset, level, now);

    // if progress is finished and the action was not already triggered -> save new selected item + do action/navigate + reset previously selected slider
    if (progressFinished && !interactionState.levels[level].dwellTriggered) {
        interactionState.levels[level].dwellTriggered = true;
        sliderState.selectedSliderType = null;

        const item = getHoveredItem(level);
        if(item.type !== "button"){     // this should never be selected if a button was hit, since the user should be able to hit it multiple times
            interactionState.levels[level].selected = interactionState.levels[level].hover
        }
        doActionOrHandleNavigation(item);
    }
}

/** Determines sub menu hover states
 *  - close submenus only if cursor is neither in menu nor in submenu (nor slider is opened)
 *  - syncs hover state of sub levels with hover depending on the parent;
 *  - deactivates deeper levels,
 *  - resets dwell for hover-change
 * => Relation between levels
 *
 * @param handDetected
 */
export function updateSubmenuInteractionState(handDetected){
    if (getCurrentUiState() === UI_STATES.SLIDER) return;

    // iterates through levels
    for (let level = 0; level < interactionState.levels.length; level++) {
        const state = interactionState.levels[level];

        // in level 0 hover is detected elsewhere, but previous hover needs to be updated still
        if (level === 0) {
            state.previousHover = state.hover;
            continue;
        }

        const selectedParent = interactionState.levels[level - 1].selected;

        // deactivate level if no hand was detected or no parent element was selected (and all deeper levels as well)
        if (!handDetected || !stateItemIsSet(selectedParent)) {
            state.hover = null;
            state.dwellStart = null;
            state.dwellProgress = 0;
            state.dwellTriggered = false;
            break;
        }

        state.hover = getHoveredSegmentForLevel(level);  // update hover -> highlight submenu if hand is detected && an element from the main menu (from higher levels) was selected

        if (state.hover !== state.previousHover) {
            state.dwellStart = null;
            state.dwellProgress = 0;
            state.dwellTriggered = false;
        }
        state.previousHover = state.hover;
    }
}

/**
 *  draws marking menu: first main level and afterwards all submenus for selected level
 */
export function drawMarkingMenu() {
    const { items } = menu;
    const angleStep = (Math.PI * 2) / items.length;     // angle per segment

    setMenuGlobalAlpha();

    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;

    // draw main menu
    for (let i = 0; i < items.length; i++) {            // loop for each segment
        const startAngle = i * angleStep;
        const endAngle = startAngle + angleStep;

        const isHighlighted = isSegmentHighlighted(0, i);
        const isSelected = i === interactionState.levels[0].selected;

        drawRingSegment(startAngle, endAngle, 0, menu.radius, isSelected, isHighlighted);
        drawLabel(menu.items[i], startAngle, endAngle, menu.radius*0.6);

        // do not draw fill animation if the progress is 0 OR this segment is not hovered OR this is already selected (confirmed with dwell time)
        const breakHoverCondition = interactionState.levels[0].dwellProgress === 0 || i !== interactionState.levels[0].hover || i === interactionState.levels[0].selected;
        drawHoverFill(breakHoverCondition, startAngle, endAngle, 0, menu.radius, 0);
    }

    // draw submenu if cursor is hovering over selected main segment OR slider is visible OR cursor is in submenu ring
    if(interactionState.levels[0].selected === interactionState.levels[0].hover || sliderState.selectedSliderType !== null || isCursorInSubMenuRing()){
        // draw submenu if a main menu segment is selected AND ((Cursor is in menu OR slider is visible) OR Cursor is in submenuring)
        if (stateItemIsSet(interactionState.levels[0].selected)) {
            // draws submenus recursively
            for (let level = 1; level < interactionState.levels.length; level++) {
                if (stateItemIsSet(interactionState.levels[level - 1].selected)) {
                    drawSubMenu(level);
                }
            }
        }
    }

    ctx.globalAlpha = 1;
}

/** helper function that makes menu faded if slider is active
 * - makes sure if dwell timer for no hands recognized is also fading the menus opacity
 */
function setMenuGlobalAlpha() {
    if (getCurrentUiState() === UI_STATES.SLIDER) {  // always fade menu if slider is active
        ctx.globalAlpha = 0.25
    } else {
        ctx.globalAlpha = getCurrentState() === STATES.DWELL ? 0.25 : 1 ;
    }
}

/** Helper function to draw the label in a segment for the main menu
 *
 * @param item
 * @param startAngle
 * @param endAngle
 * @param radius
 */
function drawLabel(item, startAngle, endAngle, radius) {
    const midAngle = (startAngle + endAngle) / 2;
    let labelX = menuPosition.x + Math.cos(midAngle) * radius;
    let labelY = menuPosition.y + Math.sin(midAngle) * radius;

    const icon = getIconForItem(item);
    const size = item.icon === "hvl-settings" ?  165 : 48; // Icon size => exception: bigger icon size TODO: make this more efficient
    if (icon) {
        ctx.drawImage(
            icon,
            labelX - size / 2,
            labelY - size / 2,
            size,
            size
        );
    } else {
        ctx.fillStyle = "black";                        // color of label
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(item.label, labelX, labelY);
    }
}

/** Helper function that draws hover animation if the hovered segment is not already selected
 * - creates a snapshot of menu segment without hover
 * - creates clip that is the size of the segment
 * - adds filling frame by frame
 * - restores snapshot without hover animation
 *
 * @param condition
 * @param startAngle
 * @param endAngle
 * @param innerRadius
 * @param outerRadius
 * @param level
 */
function drawHoverFill(condition, startAngle, endAngle, innerRadius, outerRadius, level) {
    if (condition) return;

    // draw dwell fill only for hovered segment (angle based)
    ctx.beginPath();
    ctx.moveTo(menuPosition.x, menuPosition.y);
    const fillEndAngle = startAngle + (endAngle - startAngle) * interactionState.levels[level].dwellProgress;
    ctx.arc(menuPosition.x, menuPosition.y, outerRadius, startAngle, fillEndAngle);
    ctx.arc(menuPosition.x, menuPosition.y, innerRadius, fillEndAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = MENU_COLORS.dwell;
    ctx.fill();
}

/** helper function to calculate which segment is hovered on based on the angle and distance of cursor to the center
 *
 * @returns {number|null}
 */
export function getHoveredSegmentForLevel(level) {
    if (getCurrentUiState() === UI_STATES.SLIDER) return interactionState.levels[level].selected;

    const range = getAngleRangeForLevel(level);
    if (!range) return -1;

    const { startAngle, endAngle, items } = range;

    const distance = getCursorDistance();
    const innerRadius = level === 0 ? 0 :  menu.radius + (level - 1) * menu.subRadius;    // use 0 for main level because its not a ring
    const outerRadius = menu.radius + level * menu.subRadius;

    if (distance < innerRadius || distance > outerRadius){
        return -1;
    }

    // see if current angle of cursor is in between angle borders of current level
    const currentAngle = getCursorAngle();
    if (currentAngle < startAngle || currentAngle > endAngle) return -1;

    const subStep = (endAngle - startAngle) / items.length;     // parts angle area equally in as many parts as items exist
    return Math.floor((currentAngle - startAngle) / subStep);   // calculates which segment current angle is in
}

/** Updates dwell progress
 * - resets timers and progress (= dwell) if necessary
 * - initializes timer if there is none
 * - calculates progress with the starting time
 * - returns if the progress is finished or not
 *
 * @param needsReset
 * @param level
 * @param now
 * @returns {boolean}
 */
function updateDwell(needsReset, level, now){
    if (needsReset) {
        interactionState.levels[level].dwellStart = null;
        interactionState.levels[level].dwellProgress = 0;
        interactionState.levels[level].dwellTriggered= false;
        return false;
    }

    // initialize timer if no timer was set
    if (interactionState.levels[level].dwellStart === null) {
        interactionState.levels[level].dwellStart = now;
        interactionState.levels[level].dwellTriggered = false;
        return false
    }

    // if grab gesture is done => skip dwell time OR if selection was already done, also skip dwell time
    if(isGrabbing || interactionState.levels[level].dwellTriggered){
        interactionState.levels[level].dwellProgress = 1;
        return true;
    }

    // update progress
    const elapsed = now - interactionState.levels[level].dwellStart;
    interactionState.levels[level].dwellProgress = Math.min(elapsed / HOVER_FILL_DURATION, 1);
    return interactionState.levels[level].dwellProgress === 1;
}

/** Helper function that either opens submenu or does action
 *
 * @param selectedItem
 */
function doActionOrHandleNavigation(selectedItem){
    if (!selectedItem) return;

    // if element opens submenu
    if (selectedItem.type === "menu") {
        hideSlider();
        return;
    }

    // if element opens slider
    if (selectedItem.type === "slider") {
        setCurrentUiState(UI_STATES.SLIDER)
        openSelectedSlider(selectedItem.target);
        return;
    }

    if(selectedItem.type === "button"){
        if(selectedItem.target === "presentation"){
            sendMessage({
                action: "pressed",
                type: "button",
                target: "presentation",
                value: sliderValueStorage.isPlaying ? "pause" : "play"
            })
        } else {
            console.warn("unknown button action")
        }

    }

    // hide slider for all actions except slider
    hideSlider();
}

/** Determines if cursor is in submenu ring (not main menu) using the radius and the cursor distance
 *
 * @returns {boolean}
 */
function isCursorInSubMenuRing() {
    const distance = getCursorDistance();

    const deepestLevel = getDeepestActiveLevel() + 1;

    const inner = menu.radius;
    const outer = menu.radius + deepestLevel * menu.subRadius;

    return distance >= inner && distance <= outer;
}

/**
 * helper function to return the item that is hovered (so that action/subitems can be used)
 * it loops through the levels to find the correct child elements if necessary
 * @param level
 * @returns {*}
 */
export function getHoveredItem(level) {
    let currentItems = menu.items;

    // navigate through parent levels via "selected" property and update currentItems to save the current level of items
    for (let i = 0; i < level; i++) {
        const parentSelected = interactionState.levels[i]?.selected;
        if (!stateItemIsSet(parentSelected)) return;    // no parent item -> we are probably hovering in this level

        const parentItem = currentItems[parentSelected];
        if (!parentItem?.children) return;

        currentItems = parentItem.children;
    }

    // in the aimed level, we select the hovered one
    const hoveredIndex = interactionState.levels[level]?.hover;
    if (!stateItemIsSet(hoveredIndex)) return;

    return currentItems[hoveredIndex];
}

/** Draws the submenu only for the selected main menu item
 * - calculates angles and radius for submenu + draws them
 * - highlights hovered elements
 * - draws dwell animation
 *
 */
function drawSubMenu(level) {
    const range = getAngleRangeForLevel(level);
    if (!range) return;

    const { startAngle, endAngle, items } = range;

    const innerRadius = menu.radius + (level - 1) * menu.subRadius;
    const outerRadius = menu.radius + level * menu.subRadius;

    const subAngleStep = (endAngle - startAngle) / items.length;

    for (let i = 0; i < items.length; i++) {
        const startAngleSegment = startAngle + i * subAngleStep;
        const endAngleSegment = startAngleSegment + subAngleStep;

        const isSelected = i === interactionState.levels[level].selected;
        const isHighlighted = isSegmentHighlighted(level, i);
        drawRingSegment(startAngleSegment, endAngleSegment, innerRadius, outerRadius, isSelected, isHighlighted);
        drawLabel(items[i], startAngleSegment, endAngleSegment, (innerRadius + outerRadius) / 2);

        const state = interactionState.levels[level];

        // highlight active sub-segment with dwell animation ONLY IF dwell was not already triggered (important for grab confirmation)
        const breakHoverCondition = !(i === state.hover && !state.dwellTriggered && state.dwellProgress > 0);
        drawHoverFill(breakHoverCondition, startAngleSegment, endAngleSegment, innerRadius, outerRadius, level);
    }
}

/** Helper function to draw border and fill color for submenu segments
 *

 * @param startAngle
 * @param endAngle
 * @param innerRadius
 * @param outerRadius
 * @param isSelected
 * @param isHighlighted
 */
function drawRingSegment(startAngle, endAngle, innerRadius, outerRadius, isSelected, isHighlighted) {
    ctx.beginPath();
    ctx.arc(menuPosition.x, menuPosition.y, outerRadius, startAngle, endAngle);                    // outer arc
    ctx.arc(menuPosition.x, menuPosition.y, innerRadius, endAngle, startAngle, true);   // inner arc
    ctx.closePath();
    ctx.stroke();

    // fill color: highlight sub-segment if it is hovered OR if slider is open and active (not faded + user interacts)
    if (isSelected) {
        ctx.fillStyle = MENU_COLORS.selected;      // selected
    } else if (isHighlighted) {
        ctx.fillStyle = MENU_COLORS.hover;       // hovered
    } else {
        ctx.fillStyle = MENU_COLORS.base;    // default
    }
    ctx.fill();
}

/** Checks if the state item is set
 *
 * @param stateItem
 * @returns {boolean}
 */
export function stateItemIsSet(stateItem){
    return stateItem > -1 && stateItem !== undefined && stateItem !== null
}

/** Checks if the state item is not set
 *
 * @param stateItem
 * @returns {boolean}
 */
function stateItemIsNotSet(stateItem){
    return stateItem === undefined || stateItem < 0 || stateItem === null
}

/**
 * Loads an icon by icon name from menu file
 * @param item
 * @returns {HTMLImageElement|null}
 */
function getIconForItem(item){
    if(!item?.icon) return null;

    let iconName;

    // stateful icon (e.g. Play/Pause)
    if(typeof item.icon === "object"){
        const isActive = sliderValueStorage.isPlaying && item.type === "button" && item.target === "presentation"
        iconName = isActive ? item.icon.active : item.icon.default;
    }
    // static icon
    else {
        iconName = item.icon;
    }

    return loadIcon(iconName);
}

function loadIcon(iconName){
    if (!iconName) return null;

    // if icon is already known (loaded or error)
    const cached = iconCache[iconName];
    if (cached) {
        if (cached.loaded) return cached.img;
        if (cached.failed) return null;
        return null;
    }

    const img = new Image();

    iconCache[iconName] = {
        img,
        loaded: false,
        failed: false
    };

    img.onload = () => {
        iconCache[iconName].loaded = true;
    };

    img.onerror = () => {
        iconCache[iconName].failed = true;
        console.warn("ICON NOT FOUND:", iconName);
    };

    img.src = `./images/label-icons/${iconName}.png`;

    return null;
}

/**
 * helps determine how and where to display the sliders
 * @param type
 * @returns {{position: string, orientation: string}}
 */
export function getSliderPlacementForMainItem(type) {
    // get main item that opened slider type
    const mainItem = menu.items.find(item => {
        if(item?.type === "slider") return item.target === type
    });
    const mainItemIndexThatOpenedSlider = mainItem ? menu.items.indexOf(mainItem) : interactionState.levels[0].selected;

    const angle = getMainSegmentMidAngle(mainItemIndexThatOpenedSlider);
    const position = getPlacementFromAngle(angle);
    const orientation = position === "left" || position === "right" ? "vertical" : "horizontal";

    return {
        position,      // "top" | "bottom" | "left" | "right"
        orientation     // "horizontal" | "vertical"
    };
}


/**
 *  Helps to determine if the sliders should be positioned left, right, bottom or top later
 * @param index
 * @returns {number}
 */
function getMainSegmentMidAngle(index) {
    const angleStep = (Math.PI * 2) / menu.items.length;
    const startAngle = index * angleStep;
    const endAngle = startAngle + angleStep;
    return (startAngle + endAngle) / 2;
}

/** Returns whether the slider should be positioned "top" | "bottom" | "left" | "right"
 *
 * @param angle
 * @returns {string}
 */
function getPlacementFromAngle(angle) {
    const x = Math.cos(angle);
    const y = Math.sin(angle);

    if (Math.abs(x) > Math.abs(y)) {
        return x > 0 ? "right" : "left";
    } else {
        return y > 0 ? "bottom" : "top";
    }
}

/**
 * Loops from back to front through levels of menu and returns the count with the highest selected level
 * @returns {number}
 */
export function getDeepestActiveLevel() {
    for (let i = interactionState.levels.length - 1; i >= 0; i--) {
        if (stateItemIsSet(interactionState.levels[i].selected)) {
            return i;
        }
    }
    return 0;
}

/**
 * returns if segment from parameters is highlighted or not
 * @param level
 * @param index
 * @returns {boolean}
 */
function isSegmentHighlighted(level, index) {
    const state = interactionState.levels[level];

    const isHovered = index === state.hover;
    const isSelected = index === state.selected;

    const deeperActive =
        getDeepestActiveLevel() > level;

    return isHovered || (isSelected && deeperActive);
}

/** calculates angle area recursively for level so that e.g. submenu from level 3 only the angle range from the selected menu item from the parent level has
 *
 * @param level
 * @returns {{startAngle: number, endAngle: number, items: *|DataTransferItemList}|null}
 */
function getAngleRangeForLevel(level) {
    let startAngle = 0;
    let endAngle = Math.PI * 2;
    let items = menu.items;

    for (let i = 0; i < level; i++) {
        const selected = interactionState.levels[i].selected;
        if (!stateItemIsSet(selected)) return null;

        const step = (endAngle - startAngle) / items.length;

        const newStart = startAngle + selected * step;
        const newEnd = newStart + step;

        startAngle = newStart;
        endAngle = newEnd;

        items = items[selected]?.children;
        if (!items) return null;
    }

    return { startAngle, endAngle, items };
}