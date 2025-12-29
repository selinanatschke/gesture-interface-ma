import { dwellProgress } from "./timings.js";
import { ctx } from "./main.js";
import { cursor, getCursorDistance, getCursorAngle } from "./cursor.js";
import { hideSlider, showSlider, sliderFaded, sliderVisible } from "./slider.js";

const response = await fetch("./menu.json");
export const menu = await response.json();

let selectedMainIndex = null;   // which main segment is selected (with dwell time finished)
let selectedSubIndex = null;    // which sub segment is selected (with dwell time finished)
let activeSubSegment = null;    // which sub segment cursor is in
let previousSubSegment = null;  // which sub segment was selected in the last frame

const HOVER_FILL_DURATION = 3000;   // ms, how fast segment fills on hover
const SUB_HOVER_DURATION = 3000;

// for dwell timer of main menu selection
let hoverStartTimes = new Array(menu.items.length).fill(null);
let hoverProgress = new Array(menu.items.length).fill(0);
let hoverTriggered = new Array(menu.items.length).fill(false);

// for dwell timer of sub menu selection
let subHoverStartTime = null;
let subHoverProgress = 0;
let subHoverTriggered = false;

export function drawMarkingMenu(activeIndex = -1) {
    const { x, y, radius, items } = menu;
    const angleStep = (Math.PI * 2) / items.length;     // angle per segment

    if (sliderFaded) {
        ctx.globalAlpha = 1;
    } else if (sliderVisible) {
        ctx.globalAlpha = 0.5;                          // if slider is visible, menu should be greyed out
    } else {
        ctx.globalAlpha = dwellProgress > 0 ? 0.25 : 1; // everything drawn after this is drawn with opacity 0.5
    }
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;

    for (let i = 0; i < items.length; i++) {            // loop for each segment
        const startAngle = i * angleStep;
        const endAngle = startAngle + angleStep;

        // highlight active segment by setting the fill color AND highlight main segment if cursor is in submenu
        const cursorInSubMenu = selectedMainIndex !== null && isCursorInSubMenuRing(menu, cursor); // calculate if cursor is in submenu
        const isMainHighlighted = (i === activeIndex || (cursorInSubMenu && i === selectedMainIndex)) || sliderVisible && i === selectedMainIndex ;  // highlight if: (normal hover OR cursor is in submenu) OR slider is visible AND it was done by selecting its submenu
        if (isMainHighlighted) {
            ctx.fillStyle = "rgba(255, 0, 255, 0.3)";
            // ctx.strokeStyle = "magenta";
        } else {
            ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
            // ctx.strokeStyle = "black";
        }

        // draw segment
        ctx.beginPath();
        ctx.moveTo(x, y);                                   // line starts in the middle
        ctx.arc(x, y, radius, startAngle, endAngle);        // draw arc from startAngle to endAngle
        ctx.closePath();                                    // line back to the middle
        ctx.fill();                                         // fill with background color
        ctx.stroke();                                       // draw stroke

        // calculate label position
        const midAngle = startAngle + angleStep / 2;
        const labelX = x + Math.cos(midAngle) * radius * 0.6;
        const labelY = y + Math.sin(midAngle) * radius * 0.6;

        ctx.fillStyle = "black";                        // color of label
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(items[i].label, labelX, labelY);

        // hover fill from left to right
        const progress = hoverProgress[i] || 0;
        if (progress > 0) {
            ctx.save();     // this saves a snapshot of current canvas state to stack (fillStyle, strokeStyle, ..) -> used for temporary changes

            // create segment-path new and set as a clip
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x, y, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.clip();      // changes after this only affect the clip that we just created -> rectangle is only in segment visible for the animation

            // draw dwell fill only for hovered segment (angle based)
            ctx.beginPath();
            ctx.moveTo(x, y);
            const fillEndAngle = startAngle + (endAngle - startAngle) * progress;
            ctx.arc(x, y, radius, startAngle, fillEndAngle);
            ctx.closePath();
            ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
            ctx.fill();

            // back to state that we saved to stack
            ctx.restore();
        }
    }

    // draw submenu if main segment was selected
    if (selectedMainIndex !== null) {
        drawSubMenu(selectedMainIndex);
    }

    ctx.globalAlpha = 1;    // make sure dwell timer is drawn with opacity 1 afterwards
}

// close submenus only if cursor is neither in menu nor in submenu (nor slider is opened)
// active main segment is segment in which cursor is currently (if cursor is in subsegments, activeMainSegment is -1)
export function updateSubMenuState(handDetected, activeMainSegment){
    // determines whether submenu is opened or not
    const inMainMenu = activeMainSegment !== -1;                                        // determines if cursor is in main menu
    const inSubMenu = selectedMainIndex !== null && isCursorInSubMenuRing(menu, cursor);// main menu item was selected (=submenu is open) && cursor is in submenu ring
    if (!inMainMenu && !inSubMenu) {                                                    // if cursor is not in menu + not in submenu -> remove selection from both
        selectedMainIndex = null;
        activeSubSegment = null;
    }

    // highlight submenu if hand is detected && an element from the main menu was selected
    if (handDetected && selectedMainIndex !== null) {
        activeSubSegment = getActiveSubSegment(menu, cursor, selectedMainIndex);          // determines which subsegment cursor is in
    } else {
        activeSubSegment = null;
    }

    // if we switch main menus -> also update submenu
    if (activeMainSegment !== -1 && activeMainSegment !== selectedMainIndex) {            // if cursor is in main menu AND cursor is in segment which was not selected (with dwelltime)
        selectedMainIndex = null;
        activeSubSegment = null;
    }

    // reset submenu timers if subsegment has changed (previous = previous frame)
    if (activeSubSegment !== previousSubSegment) {
        subHoverStartTime = null;
        subHoverProgress = 0;
        subHoverTriggered = false;
    }
    previousSubSegment = activeSubSegment;
}

// calculate which segment is hovered on based on the angle
export function getActiveMainSegment() {
    const distance = getCursorDistance(menu, cursor);

    const outerRadius = menu["radius"];

    // cursor not in menu
    if (distance > outerRadius) {
        return -1;
    }

    const angle = getCursorAngle(menu, cursor);
    const angleStep = (Math.PI * 2) / menu.items.length;

    return Math.floor(angle / angleStep);
}

// calculates dwell times on hovering a menu item
export function updateHoverFill(now, activeIndex) {
    for (let i = 0; i < menu.items.length; i++) {
        if (i === activeIndex && selectedMainIndex == null) {     // start fill animation if cursor is inside but only if submenu is not already open
            if (hoverStartTimes[i] === null) {
                hoverStartTimes[i] = now;
                hoverTriggered[i] = false;
            }

            const elapsed = now - hoverStartTimes[i];
            hoverProgress[i] = Math.min(elapsed / HOVER_FILL_DURATION, 1);

            if (hoverProgress[i] >= 1 && !hoverTriggered[i]) {
                hoverTriggered[i] = true;
                selectedMainIndex = i;

                // if a new main segment is selected, hide the slider from the old selection
                if (sliderVisible) {
                    hideSlider();
                }
            }
        } else {
            // not in segment anymore -> reset
            hoverStartTimes[i] = null;
            hoverProgress[i] = 0;
            hoverTriggered[i] = false;
        }
    }
}


// calculates dwell times on hovering a submenu item
export function updateSubHover(now) {

    // TODO correct highlight of subitem when slider is not faded!

    // if no main menu item was selected OR no submenu item is hovered, reset all dwell timers and return OR the slider is visible and cursor is in slider -> prevents accidental selection of other item while using the slider
    if (selectedMainIndex === null || activeSubSegment === null || sliderVisible && !sliderFaded) {
        subHoverStartTime = null;
        subHoverProgress = 0;
        subHoverTriggered = false;
        return;
    }

    // if no start time was set, set one
    if (subHoverStartTime === null) {
        subHoverStartTime = now;
        subHoverTriggered = false;
    }

    // calculate progress and if it was already finished
    const elapsed = now - subHoverStartTime;
    subHoverProgress = Math.min(elapsed / SUB_HOVER_DURATION, 1);

    // if progress is finished
    if (subHoverProgress >= 1 && !subHoverTriggered) {
        subHoverTriggered = true;
        const item = menu.items[selectedMainIndex].subItems[activeSubSegment];
        if (item.action) {
            selectedSubIndex = activeSubSegment;
            handleMenuAction(item.action);
        }
    }
}

function isCursorInSubMenuRing(menu, cursor) {
    const distance = getCursorDistance(menu, cursor);
    const inner = menu["radius"];
    const outer = menu["radius"] + 80; // same as submenu

    return distance >= inner && distance <= outer;
}

// calculates active subsegment by angle and distance of cursor to the center
function getActiveSubSegment(menu, cursor, mainIndex) {
    if (mainIndex === null) return -1;

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
    const subStep = (endAngle - startAngle) / subItems.length;

    return Math.floor((angle - startAngle) / subStep);
}

// calculates angles and radius for submenu + draws them
function drawSubMenu(selectedMainIndex) {
    const subItems = menu.items[selectedMainIndex].subItems;
    if (!subItems) return;

    const angleStep = (Math.PI * 2) / menu.items.length;

    const startAngle = selectedMainIndex * angleStep;
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

        // highlight active sub-segment
        if (i === activeSubSegment ) {
            ctx.fillStyle = "rgba(255, 0, 255, 0.3)";
            ctx.fill();

            // dwell fill (radial)
            if (subHoverProgress > 0) {
                ctx.beginPath();
                ctx.moveTo(menu.x, menu.y);

                const fillEnd =
                    a0 + (a1 - a0) * subHoverProgress;

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
