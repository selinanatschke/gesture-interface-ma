import { dwellProgress } from "./timings.js";
import { ctx } from "./main.js";
import { cursor, getCursorDistance, getCursorAngle } from "./cursor.js";
import { hideSlider, showSlider, showSliderPreview, sliderState, uiMode } from "./slider.js";

const response = await fetch("./menu.json");
export const menu = await response.json();

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

const HOVER_FILL_DURATION = 3000;   // ms, how fast segment fills on hover

export function drawMarkingMenu() {
    const { x, y, radius, items } = menu;
    const angleStep = (Math.PI * 2) / items.length;     // angle per segment

    setMenuGlobalAlpha();

    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;

    for (let i = 0; i < items.length; i++) {            // loop for each segment
        const startAngle = i * angleStep;
        const endAngle = startAngle + angleStep;

        const isHighlighted = isMainSegmentHighlighted(i);

        drawSegment(x, y, radius, startAngle, endAngle, isHighlighted);
        drawMainLabel(i, x, y, radius, startAngle, endAngle);
        drawHoverFill(i, x, y, radius, startAngle, endAngle);
    }

    // draw submenu if cursor is hovering over selected main segment or interacting with a slider
    const cursorInMenu = checkIfCursorIsInMenu()
    if(interactionState.main.selected === interactionState.main.hover || sliderState.visible || isCursorInSubMenuRing()){
        // draw submenu if a main menu segment is selected AND ((Cursor is in menu OR slider is visible) OR Cursor is in submenuring)
        if (stateItemIsSet(interactionState.main.selected)) {
            drawSubMenu();
        }
    }

    ctx.globalAlpha = 1;
}

function setMenuGlobalAlpha() {
    if (uiMode.current === "menu") {
        ctx.globalAlpha = 1;
    } else if (sliderState.visible) {     // if slider is visible, menu should be greyed out
        ctx.globalAlpha = 0.5;
    } else {
        ctx.globalAlpha = dwellProgress > 0 ? 0.25 : 1;
    }
}

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
        || (sliderState.visible && i === interactionState.main.selected && uiMode.current === "slider")     // slider keeps highlight
    );
}

function drawSegment(x, y, radius, startAngle, endAngle, highlighted) {
    ctx.fillStyle = highlighted
        ? "rgba(255, 0, 255, 0.3)"
        : "rgba(0, 0, 0, 0.05)";

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawMainLabel(i, x, y, radius, startAngle, endAngle) {
    const midAngle = (startAngle + endAngle) / 2;
    const labelX = x + Math.cos(midAngle) * radius * 0.6;
    const labelY = y + Math.sin(midAngle) * radius * 0.6;

    ctx.fillStyle = "black";                        // color of label
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(menu.items[i].label, labelX, labelY);
}

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

// close submenus only if cursor is neither in menu nor in submenu (nor slider is opened)
// active main segment is segment in which cursor is currently (if cursor is in subsegments, activeMainSegment is -1)
export function updateSubMenuState(handDetected){
    const activeMainSegment = interactionState.main.hover;

    // determines whether submenu is opened or not
    const inMainMenu = activeMainSegment !== -1;                                        // determines if cursor is in main menu
    const inSubMenu = interactionState.main.selected !== null && isCursorInSubMenuRing();            // main menu item was selected (=submenu is open) && cursor is in submenu ring
    if (!inMainMenu && !inSubMenu && uiMode.current === "menu") {                                             // if cursor is not in menu + not in submenu -> remove selection from both (only if slider is not open)
        interactionState.main.selected = null;
        interactionState.sub.hover = null;
    }

    // highlight submenu if hand is detected && an element from the main menu was selected
    if (handDetected && ( interactionState.main.selected > -1 || interactionState.main.selected !== null|| interactionState.main.selected !== undefined )) {
        interactionState.sub.hover = getActiveSubSegment(menu, cursor);          // determines which subsegment cursor is in
    } else {
        interactionState.sub.hover = null;
    }

    // if we switch main menus -> also update submenu
    if (activeMainSegment !== -1 && activeMainSegment !== interactionState.main.selected && sliderState.visible && uiMode.current === "slider") {            // if cursor is in main menu AND cursor is in segment which was not selected (with dwelltime)
        interactionState.main.selected = null;
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

// calculate which segment is hovered on based on the angle
export function getActiveMainSegment() {
    // if slider is visible and slider is not faded (in use) the activeMainSegment should be the one that opened the slider
    if( sliderState.visible && uiMode.current === "slider" ) return interactionState.main.selected;

    const distance = getCursorDistance(menu, cursor);

    const outerRadius = menu["radius"];

    // cursor not in menu
    if (distance > outerRadius) {
        return -1;
    }

    const angle = getCursorAngle(menu, cursor);
    const angleStep = (Math.PI * 2) / menu.items.length;

    const result = Math.floor(angle / angleStep);
    if (result > -1){
        return result;
    }
}

/** calculates dwell times on hovering a menu item
 * if menu item is hovered & slider is not in interactive mode -> start dwell -> if completed -> do action
 * @param now
 * @param level : this decides if main menu or x. level (submenu) is opened
 **/
export function updateHoverFill(now, level) {
    level = level === 0 ? "main" : "sub";
    handlePreview(level)

    if(stateItemIsSet(interactionState.sub.hover) && level === "main") return;       // if sub element is hovered, skip this for main element

    // prevent dwell interaction while slider is used + only active sliders block hover (preview is not an active slider)
    if (sliderState.visible && uiMode.current === "slider") return;
    const hoveredItem = interactionState[level].hover;

    const needsReset = level === "main"?
        // level 0: nothing hovered OR selection already made OR switch of hovered segment -> reset
        stateItemIsNotSet(hoveredItem) || hoveredItem !== interactionState.main.previousHover :
        // level 1: if no main menu item was selected OR no submenu item is hovered, reset all dwell timers and return OR the slider is visible and cursor is in slider -> prevents accidental selection of other item while using the slider
        stateItemIsNotSet(interactionState.main.selected) || stateItemIsNotSet(interactionState.sub.hover) || sliderState.visible && uiMode.current === "slider"

    if (needsReset) {
        interactionState[level].dwellStart = null;
        interactionState[level].dwellProgress = 0;
        interactionState[level].dwellTriggered= false;
        return;
    }

    // initialize timer if no timer was set
    if (interactionState[level].dwellStart === null) {
        interactionState[level].dwellStart = now;
        interactionState[level].dwellTriggered = false;
    }

    // update progress
    const elapsed = now - interactionState[level].dwellStart;
    interactionState[level].dwellProgress = Math.min(elapsed / HOVER_FILL_DURATION, 1);

    // trigger after dwell threshold
    if (interactionState[level].dwellProgress >= 1 && !interactionState[level].dwellTriggered) {
        interactionState[level].dwellTriggered = true;
        interactionState[level].selected = interactionState[level].hover

        const item = level === "main" ? getHoveredItem("main") : getHoveredItem("sub");
        doActionOrHandleNavigation(item);
    }
}

function doActionOrHandleNavigation(selectedItem){
    if (!itemHasSubItems(selectedItem) && selectedItem.action) {
        handleMenuAction(selectedItem.action);
        sliderState.preview = false;
    } else{
        hideSlider();
    }
}

function isCursorInSubMenuRing() {
    const distance = getCursorDistance(menu, cursor);
    const inner = menu["radius"];
    const outer = menu["radius"] + 80; // same as submenu

    return distance >= inner && distance <= outer;
}

// close preview if hover does not match owner
function handlePreview(level){
    // TODO if slider is active (selected) and user hovers over another item with a preview, the active slider disappears completely if user wants to interact

    if (sliderState.preview) {
        const owner = sliderState.previewOwner;

        const stillHovered =
            owner?.level === 0
                ? interactionState.main.hover === owner.index
                : (
                    interactionState.sub.hover === owner.sub &&
                    interactionState.main.selected === owner.main
                );

        if (!stillHovered) {
            hideSlider();
            sliderState.preview = false;
            sliderState.previewOwner = null;
        }
    }

    // preview
    if (interactionState[level].dwellProgress > 0 && interactionState[level].dwellProgress < 1){
        const hoveredItem =
            level === 0 ? getHoveredItem("main") : getHoveredItem("sub");
        if (!itemHasSlider(hoveredItem)) return;
        const owner =
            level === 0
                ? { level: 0, index: interactionState.main.hover }
                : { level: 1, main: interactionState.main.selected, sub: interactionState.sub.hover };

        if (!sliderState.preview) {
            showSliderPreview(hoveredItem.action.type, owner);
        }
    }

    // slider preview if hover but not confirmed yet
    if (interactionState[level].dwellProgress > 0 && interactionState[level].dwellProgress < 1) {
        const hoveredItem = level === 0 ? getHoveredItem("main") : getHoveredItem("sub");

        const owner =
            level === 0
                ? { level: 0, index: interactionState.main.hover }
                : { level: 1, main: interactionState.main.selected, sub: interactionState.sub.hover };

        if (itemHasSlider(hoveredItem) && !sliderState.preview) {
            showSliderPreview(hoveredItem.action.type, owner);

        }
    }
}

/** This method checks if the cursor is still in the submenu and if the selection has to be resetted.
 * The selection must be resetted, if:
 * - the cursor is not in the menu, nor in a submenu and it is no slider visible
 * @returns {boolean}
 */
function checkIfCursorIsInMenu() {
    const distance = getCursorDistance(menu, cursor);
    const mainMenuCircle = menu["radius"];
    const cursorInMenu =  distance <= mainMenuCircle;

    if (cursorInMenu) {
        return true;
    } else {
        if(!isCursorInSubMenuRing() && !sliderState.visible){
            interactionState.main.selected = null;
        }
        return false;
    }
}

// calculates active subsegment by angle and distance of cursor to the center
function getActiveSubSegment() {
    // if slider is visible and slider is not faded (in use) the activeSubSegment should be the one that opened the slider
    if( sliderState.visible && uiMode.current === "slider" ) return interactionState.sub.selected;

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

function getHoveredItem(level){
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

// calculates angles and radius for submenu + draws them
function drawSubMenu() {
    const itemIndex = interactionState.main.selected;

    const subItems = menu.items[itemIndex].subItems;
    if (!subItems) return;

    const angleStep = (Math.PI * 2) / menu.items.length;

    const startAngle = itemIndex * angleStep;
    const endAngle = startAngle + angleStep;

    const innerRadius = menu["radius"];
    const outerRadius = menu["radius"] + 60;

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

        ctx.fillStyle = "black";
        ctx.fillText(
            subItems[i].label,
            menu.x + Math.cos(mid) * r,
            menu.y + Math.sin(mid) * r
        );

        // highlight sub-segment if it is hovered OR if slider is open and active (not faded + user interacts)
        if (i === interactionState.sub.hover || i === interactionState.sub.selected && sliderState.visible && uiMode.current === "slider"){
            ctx.fillStyle = "rgba(255, 0, 255, 0.3)";
            ctx.fill();
        }

        // highlight active sub-segment with dwell animation
        if (i === interactionState.sub.hover) {
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

// draw border and fill color for submenu segments
function drawRingSegment(x, y, innerR, outerR, startAngle, endAngle) {
    ctx.beginPath();
    ctx.arc(x, y, outerR, startAngle, endAngle);                    // outer arc
    ctx.arc(x, y, innerR, endAngle, startAngle, true);   // inner arc
    ctx.closePath();
}

// handles actions of menu selection
// todo not only for submenus!
function handleMenuAction(action) {
    switch (action.name) {
        case "open_slider":
            showSlider(action.type);    // enables slider
            break;

        default:
            console.warn("Unknown action type", action);
    }
}

function stateItemIsSet(stateItem){
    return stateItem > -1 && stateItem !== undefined && stateItem !== null
}
function stateItemIsNotSet(stateItem){
    return stateItem === undefined || stateItem < 0 || stateItem === null
}

function itemHasSlider(item) {
    return item?.action?.name === "open_slider";
}

function itemHasSubItems(item){
    if (!item) return
    return Object.hasOwn(item, 'subItems')
}