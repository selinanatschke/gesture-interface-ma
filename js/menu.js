import { dwellProgress } from "./timings.js";
import { ctx } from "./main.js";
import { cursor, getCursorDistance, getCursorAngle } from "./cursor.js";
import { handlePreview, hideSlider, openSelectedSlider, sliderState, uiMode } from "./slider.js";
import { isGrabbing } from "./gestures.js";

const response = await fetch("./menu.json");
export const menu = await response.json();

/**
 *  Scale steps for administrating the size of the application
 * @type {{radiusStep: number, minRadius: number, maxRadius: number}}
 */
export const UI_SCALE = {
    radiusStep: 20,
    minRadius: 120,
    maxRadius: 500
};

/** State that saves all information about the menu levels
 * currently: two levels: main, sub (can later be expanded with subsub, or 2)
 *
 * - hover - which element in this level is currently hovered?
 * - selected - which element in this level is currently selected (=with confirmed action like dwell time)?
 * - dwellStart - start time of hover dwell
 * - dwellProgress - 0..1, shows how far hover dwell is
 * - dwellTriggered - shows if dwell is already triggered (important so that action is not done every frame)
 * - previousHover - shows which element was hovered in the last frame (important because otherwise you cannot tell if the hover switched menu items)
 *
 * @type {{main: {hover: null, selected: null, dwellStart: null, dwellProgress: number, dwellTriggered: boolean, previousHover: null}, sub: {hover: null, selected: null, dwellStart: null, dwellProgress: number, dwellTriggered: boolean, previousHover: null}}}
 */
export const interactionState = {
    main: {
        hover: null,
        selected: null,
        dwellStart: null,
        dwellProgress: 0,
        dwellTriggered: false,
        previousHover: null
    },
    sub: {
        hover: null,
        selected: null,
        dwellStart: null,
        dwellProgress: 0,
        dwellTriggered: false,
        previousHover: null
    }
};

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

/** calculates dwell times on hovering a menu item
 * - handles menu selection
 * - if menu item is hovered & slider is not in interactive mode -> start dwell -> if completed -> do action/open submenu
 * @param now
 * @param level : this decides if main menu or x. level (submenu) is opened
 **/
export function updateHoverFill(now, level) {
    level = level === 0 ? "main" : "sub";
    handlePreview(level)

    // if sub element is hovered, do not calculate hover for main element
    if(stateItemIsSet(interactionState.sub.hover) && level === "main") return;

    // if a main element is selected and the slider is not active, and the main selection switches -> reset main selection
    if(stateItemIsSet(interactionState.main.selected)
        && !sliderState.visible
        && interactionState.main.hover !== interactionState.main.previousHover
        && !isCursorInSubMenuRing()) {
        interactionState.main.selected = null;
    }

    // do we need to abort hover animation?
    const needsReset = level === "main" ?
        // level 0: nothing hovered OR selection already made OR switch of hovered segment -> reset
        stateItemIsNotSet(interactionState.main.hover) || interactionState.main.hover !== interactionState.main.previousHover :
        // level 1: if no main menu item was selected OR no submenu item is hovered, reset all dwell timers and return
        stateItemIsNotSet(interactionState.main.selected) || stateItemIsNotSet(interactionState.sub.hover)

    const progressFinished = updateDwell(needsReset, level, now);

    // if progress is finished and the action was not already triggered -> save new selected item + do action/navigate + reset previously selected slider
    if (progressFinished && !interactionState[level].dwellTriggered) {
        interactionState[level].dwellTriggered = true;
        interactionState[level].selected = interactionState[level].hover
        sliderState.selectedSliderType = null;

        const item = level === "main" ? getHoveredItem("main") : getHoveredItem("sub");
        doActionOrHandleNavigation(item);
    }
}

/** Determines sub menu hover states
 *  - close submenus only if cursor is neither in menu nor in submenu (nor slider is opened)
 *  - active main segment is segment in which cursor is currently (if cursor is in subsegments, activeMainSegment is -1)
 * @param handDetected
 */
export function updateSubMenuState(handDetected){
    if (uiMode.current === "slider") return;

    // highlight submenu if hand is detected && an element from the main menu was selected
    if (handDetected && stateItemIsSet(interactionState.main.selected)) {
        interactionState.sub.hover = getActiveSubSegment();          // determines which subsegment cursor is in
    } else {
        interactionState.sub.hover = null;
    }

    // reset submenu timers if subsegment has changed (previous = previous frame)
    if (interactionState.sub.hover !== interactionState.sub.previousHover) {
        interactionState.sub.dwellStart = null;
        interactionState.sub.dwellProgress = 0;
        interactionState.sub.dwellTriggered = false;
    }
    interactionState.sub.previousHover = interactionState.sub.hover;
    interactionState.main.previousHover = interactionState.main.hover;
}

/**
 *  draws marking menu (only first level)
 */
export function drawMarkingMenu() {
    const { x, y, radius, items } = menu;
    const angleStep = (Math.PI * 2) / items.length;     // angle per segment

    setMenuGlobalAlpha();

    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;

    for (let i = 0; i < items.length; i++) {            // loop for each segment
        const startAngle = i * angleStep;
        const endAngle = startAngle + angleStep;

        const isHighlighted = isMainSegmentHighlighted(i);
        const isSelected = i === interactionState.main.selected;

        drawSegment(x, y, radius, startAngle, endAngle, isSelected, isHighlighted);
        drawMainLabel(i, x, y, radius, startAngle, endAngle);
        drawHoverFill(i, x, y, radius, startAngle, endAngle);
    }

    // draw submenu if cursor is hovering over selected main segment OR slider is visible OR cursor is in submenu ring
    if(interactionState.main.selected === interactionState.main.hover || sliderState.selectedSliderType !== null || isCursorInSubMenuRing()){
        // draw submenu if a main menu segment is selected AND ((Cursor is in menu OR slider is visible) OR Cursor is in submenuring)
        if (stateItemIsSet(interactionState.main.selected)) {
            drawSubMenu();
        }
    }

    ctx.globalAlpha = 1;
}

/** helper function that makes menu faded if slider is active
 * - makes sure if dwell timer for no hands recognized is also fading the menus opacity
 */
function setMenuGlobalAlpha() {
    if (uiMode.current === "slider") {  // always fade menu if slider is active
        ctx.globalAlpha = 0.25
    } else {
        ctx.globalAlpha = dwellProgress > 0 ? 0.25 : 1 ;
    }
}

/**
 * Helper function that sums up cases in which main segment should be highlighted, these cases are:
 * - normal hover
 * - if main selected and the cursor is in the submenu that was opened by the selected main item
 * - if the user is interacting with the slider, then the main menu item that opened the slider should stay highlighted
 * @param i
 * @returns {boolean|*}
 */
function isMainSegmentHighlighted(i) {
    const activeMainSegment = interactionState.main.hover;
    const selectedMainSegment = interactionState.main.selected;

    // if main segment is selected, check if it has subItems
    const hasSubItems = stateItemIsSet(selectedMainSegment) ? itemHasSubItems(menu.items[selectedMainSegment]) : false;

    // check if cursor is in submenuRing
    const cursorInSubMenu =
        stateItemIsSet(interactionState.main.selected) && (hasSubItems && isCursorInSubMenuRing()); // calculate if cursor is in submenu

    return (
        i === activeMainSegment                                   // normal hover
        || (cursorInSubMenu && i === interactionState.main.selected)   // cursor in submenu (+ submenu exists)
    );
}

/**
 *  helper function to draw a circle segment for the main menu level
 * @param x
 * @param y
 * @param radius
 * @param startAngle
 * @param endAngle
 * @param isSelected
 * @param isHovered
 */
function drawSegment(x, y, radius, startAngle, endAngle, isSelected, isHovered) {
    if (isSelected) {
        ctx.fillStyle = "rgba(255, 0, 255, 0.5)";      // selected
    } else if (isHovered) {
        ctx.fillStyle = "rgba(255, 0, 255, 0.3)";       // hovered
    } else {
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";          // default
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

/** Helper function to draw the label in a segment for the main menu
 *
 * @param i
 * @param x
 * @param y
 * @param radius
 * @param startAngle
 * @param endAngle
 */
function drawMainLabel(i, x, y, radius, startAngle, endAngle) {
    const midAngle = (startAngle + endAngle) / 2;
    const labelX = x + Math.cos(midAngle) * radius * 0.6;
    const labelY = y + Math.sin(midAngle) * radius * 0.6;

    const icon = getIconForLabel(menu.items[i].label);
    const size = menu.items[i].label === "H, V, L einstellen" ?  165 : 48; // Icon size => exception: bigger icon size TODO: make this more efficient
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
        ctx.fillText(menu.items[i].label, labelX, labelY);
    }
}

/** Helper function that draws hover animation if the hovered segment is not already selected
 * - creates a snapshot of menu segment without hover
 * - creates clip that is the size of the segment
 * - adds filling frame by frame
 * - restores snapshot without hover animation
 *
 * @param i
 * @param x
 * @param y
 * @param radius
 * @param startAngle
 * @param endAngle
 */
function drawHoverFill(i, x, y, radius, startAngle, endAngle) {
    const activeMainSegment = interactionState.main.hover;

    // do not draw fill animation if the progress is 0 OR this segment is not hovered OR this is already selected (confirmed with dwell time)
    if (interactionState.main.dwellProgress === 0 || i !== activeMainSegment || i === interactionState.main.selected) return;

    // create segment-path new and set as a clip
    ctx.save();             // this saves a snapshot of current canvas state to stack (fillStyle, strokeStyle, ..) -> used for temporary changes
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.clip();      // changes after this only affect the clip that we just created -> rectangle is only in segment visible for the animation

    // draw dwell fill only for hovered segment (angle based)
    ctx.beginPath();
    ctx.moveTo(x, y);
    const fillEndAngle = startAngle + (endAngle - startAngle) * interactionState.main.dwellProgress;
    ctx.arc(x, y, radius, startAngle, fillEndAngle);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fill();

    // back to state that we saved to stack
    ctx.restore();
}

/** helper function to calculate which segment is hovered on based on the angle
 *
 * @returns {number|null}
 */
export function getActiveMainSegment() {
    if (uiMode.current === "slider") return interactionState.main.selected;

    const distance = getCursorDistance();
    const outerRadius = menu["radius"];

    // cursor not in menu
    if (distance > outerRadius) {
        return -1;
    }

    const angle = getCursorAngle();
    const angleStep = (Math.PI * 2) / menu.items.length;

    const result = Math.floor(angle / angleStep);
    if (result > -1){
        return result;
    }
}

/** Updates dwwell progress
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
        interactionState[level].dwellStart = null;
        interactionState[level].dwellProgress = 0;
        interactionState[level].dwellTriggered= false;
        return false;
    }

    // initialize timer if no timer was set
    if (interactionState[level].dwellStart === null) {
        interactionState[level].dwellStart = now;
        interactionState[level].dwellTriggered = false;
        return false
    }

    // if grab gesture is done => skip dwell time OR if selection was already done, also skip dwell time
    if(isGrabbing || interactionState[level].dwellTriggered){
        interactionState[level].dwellProgress = 1;
        return true;
    }

    // update progress
    const elapsed = now - interactionState[level].dwellStart;
    interactionState[level].dwellProgress = Math.min(elapsed / HOVER_FILL_DURATION, 1);
    return interactionState[level].dwellProgress === 1;
}

/** Helper function that either opens submenu or does action
 *
 * @param selectedItem
 */
function doActionOrHandleNavigation(selectedItem){
    if (!itemHasSubItems(selectedItem) && selectedItem.action) {
        handleMenuAction(selectedItem.action);
    } else{
        // items that open different sub menu
        hideSlider();
    }
}

/** Determines if cursor is in submenu ring (not main menu) using the radius and the cursor distance
 *
 * @returns {boolean}
 */
function isCursorInSubMenuRing() {
    const distance = getCursorDistance(menu, cursor);
    const inner = menu["radius"];
    const outer = menu["radius"] + 80; // same as submenu

    return distance >= inner && distance <= outer;
}

/** helper function to calculate which sub segment is hovered on based on the angle and distance of cursor to the center
 *
 * @returns {number|null}
 */
function getActiveSubSegment() {
    const mainIndex = interactionState.main.selected;
    if (stateItemIsNotSet(mainIndex)) return -1;

    const distance = getCursorDistance(menu, cursor);
    const inner = menu["radius"];
    const outer = menu["radius"] + 80;

    if (distance < inner || distance > outer) return -1;

    const angle = getCursorAngle(menu, cursor);

    const angleStep = (Math.PI * 2) / menu.items.length;
    const startAngle = mainIndex * angleStep;
    const endAngle = startAngle + angleStep;

    if (angle < startAngle || angle > endAngle) return -1;

    const subItems = menu.items[mainIndex].subItems;
    if (!subItems) return;      // if element does not have children, return
    const subStep = (endAngle - startAngle) / subItems.length;

    const result = Math.floor((angle - startAngle) / subStep)
    if (result > -1) {
        return result;
    }
}

/**
 * helper function to return the item that is hovered (so that action/subitems can be used)
 * @param level
 * @returns {*}
 */
export function getHoveredItem(level){
    // main item
    if(level === "main" || level === 0){
        return menu.items[interactionState.main.hover]

    // sub item
    } else if (level === "sub" || level === 1) {
        const main = interactionState.main.selected;
        const sub  = interactionState.sub.hover;

        if (
            stateItemIsSet(main) &&
            stateItemIsSet(sub)
        ) {
            return menu.items[main].subItems[sub];
        }
    }
}

/** Draws the submenu only for the selected main menu item
 * - calculates angles and radius for submenu + draws them
 * - highlights hovered elements
 * - draws dwell animation
 *
 */
function drawSubMenu() {
    const itemIndex = interactionState.main.selected;

    const subItems = menu.items[itemIndex].subItems;
    if (!subItems) return;

    const angleStep = (Math.PI * 2) / menu.items.length;

    const startAngle = itemIndex * angleStep;
    const endAngle = startAngle + angleStep;

    const innerRadius = menu["radius"];
    const outerRadius = menu["radius"] + menu["subRadius"];

    const subAngleStep = (endAngle - startAngle) / subItems.length;

    for (let i = 0; i < subItems.length; i++) {
        const a0 = startAngle + i * subAngleStep;
        const a1 = a0 + subAngleStep;

        drawRingSegment(
            menu.x,
            menu.y,
            innerRadius,
            outerRadius,
            a0,
            a1
        );

        ctx.stroke();

        // label
        const mid = (a0 + a1) / 2;
        const r = (innerRadius + outerRadius) / 2;

        const icon = getIconForLabel(subItems[i].label);
        const size = 48;

        const ix = menu.x + Math.cos(mid) * r;
        const iy = menu.y + Math.sin(mid) * r;

        if (icon) {
            ctx.drawImage(icon, ix - size / 2, iy - size / 2, size, size);
        } else {
            ctx.fillStyle = "black";
            ctx.fillText(subItems[i].label, ix, iy);
        }

        // highlight sub-segment if it is hovered OR if slider is open and active (not faded + user interacts)
        if (i === interactionState.sub.hover || i === interactionState.sub.selected){
            ctx.fillStyle = i === interactionState.sub.selected ? "rgba(255, 0, 255, 0.5)" : "rgba(255, 0, 255, 0.3)";      // if selection confirmed => darker tone
            ctx.fill();
        }

        // highlight active sub-segment with dwell animation ONLY IF dwell was not already triggered (important for grab confirmation)
        if (i === interactionState.sub.hover  && !interactionState.sub.dwellTriggered) {
            // dwell fill (radial)
            if (interactionState.sub.dwellProgress > 0) {
                ctx.beginPath();
                ctx.moveTo(menu.x, menu.y);

                const fillEnd =
                    a0 + (a1 - a0) * interactionState.sub.dwellProgress;

                ctx.arc(menu.x, menu.y, outerRadius, a0, fillEnd);
                ctx.arc(menu.x, menu.y, innerRadius, fillEnd, a0, true);
                ctx.closePath();

                ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
                ctx.fill();
            }
        }
    }
}

/** Helper function to draw border and fill color for submenu segments
 *
 * @param x
 * @param y
 * @param innerR
 * @param outerR
 * @param startAngle
 * @param endAngle
 */
function drawRingSegment(x, y, innerR, outerR, startAngle, endAngle) {
    ctx.beginPath();
    ctx.arc(x, y, outerR, startAngle, endAngle);                    // outer arc
    ctx.arc(x, y, innerR, endAngle, startAngle, true);   // inner arc
    ctx.closePath();
}

/** handles actions of menu selection
 *
 * @param action
 */
function handleMenuAction(action) {
    switch (action.name) {
        case "open_slider":
            sliderState.preview = false;
            uiMode.current = "slider";
            openSelectedSlider(action.type);
            break;

        default:
            // hide slider for all actions except open_slider
            hideSlider()
            console.warn("Unknown action type", action);
    }
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

/** Checks if the item has a slider as their action.
 *
 * @param item
 * @returns {boolean}
 */
export function itemHasSlider(item) {
    return item?.action?.name === "open_slider";
}

/** Checks if the item has subItems
 *
 * @param item
 * @returns {boolean}
 */
export function itemHasSubItems(item){
    if (!item) return
    return Object.hasOwn(item, 'subItems')
}

/**
 * Loads an icon by label name (cached)
 * @param {string} label
 * @returns {HTMLImageElement}
 */
function getIconForLabel(label) {
    if (!label) return null;

    // if icon is already known (loaded or error)
    const cached = iconCache[label];
    if (cached) {
        if (cached.loaded) return cached.img;
        if (cached.failed) return null;
        return null; // noch am Laden
    }

    const img = new Image();

    iconCache[label] = {
        img,
        loaded: false,
        failed: false
    };

    img.onload = () => {
        iconCache[label].loaded = true;
    };

    img.onerror = () => {
        iconCache[label].failed = true;
        console.warn("ICON NOT FOUND:", label);
    };

    img.src = `./images/label-icons/${label}.png`;

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
        if(itemHasSlider(item)) return item.action.type === type
    });
    const mainItemIndexThatOpenedSlider = mainItem ? menu.items.indexOf(mainItem) : interactionState.main.selected;

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