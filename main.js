const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const IDLE_BEFORE_DWELL = 5000; // systems waits this time if no hand was recognized -> after this time dwell timer is started
let idleStartTime = null;       // saves start time of idle timer

const DWELL_DURATION = 3000;    // time for the dwell timer
let dwellProgress = 0;          // 0..1
let dwellStartTime = null;      // saves start time of dwell timer

const HOVER_FILL_DURATION = 3000;   // ms, how fast segment fills on hover

let cursor = {
    x: 0,
    y: 0,
    visible: false,
};

const menu = {
    x: 0,       // later menu.x = cursor.x to set menu where cursor appears
    y: 0,
    radius: 200,
    items: [
        {
            label: "A",
            subItems: [
                { label: "A1" },
                { label: "A2" },
                { label: "A3" }
            ]
        },
        {
            label: "B",
            subItems: [
                { label: "B1" },
                { label: "B2" },
            ]
        },
        {
            label: "C",
            subItems: [
                { label: "C1" },
                { label: "C2" },
                { label: "C3" }
            ]
        }
    ]
};

let hoverStartTimes = new Array(menu.items.length).fill(null);
let hoverProgress = new Array(menu.items.length).fill(0);
let hoverTriggered = new Array(menu.items.length).fill(false);

let activeMainIndex = null;   // which main segment is selected
let activeSubIndex = null;    // which sub segment is selected

// adapt canvas to window size
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    menu.x = canvas.width / 2;
    menu.y = canvas.height / 2;
}
window.addEventListener("resize", resize);
resize();

// instiate mediapipe hand
const hands = new Hands({
    locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
});

// results per frame
hands.onResults((results) => {
    const now = performance.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let activeSegment = -1;

    // check if hand is detected -> if yes, reset timers; if not, update idle timer
    const handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
    if(handDetected && dwellProgress > 0){
        resetTimers()
    }
    const dwellShouldRun = updateIdle(handDetected, now);

    // if dwell timer should run, update values and draw it
    if (dwellShouldRun) {
        updateDwell(now);
    }

    // if dwell timer is running, draw dwell ring
    if (dwellProgress > 0 && dwellProgress < 1) {
        drawDwellRing(dwellProgress);
    }

    // if dwell timer is not active or <1, paint menu
    if (dwellProgress < 1) {
        if (handDetected) {
            updateCursor(results);
            activeSegment = getActiveSegment(menu, cursor);
            updateHoverFill(now, activeSegment);
        }
        drawMarkingMenu(menu, activeSegment);
    }

    updateSubMenuState(handDetected, activeSegment)
});

// close submenus only if cursor is neither in menu nor in submenu
function updateSubMenuState(handDetected, activeSegment){
    const inMainMenu = activeSegment !== -1;
    const inSubMenu = activeMainIndex !== null && isCursorInSubMenuRing(menu, cursor);
    if (!inMainMenu && !inSubMenu) {
        activeMainIndex = null;
    }

    // highlight submenu
    if (handDetected && activeMainIndex !== null) {
        activeSubIndex = getActiveSubSegment(menu, cursor, activeMainIndex);
    } else {
        activeSubIndex = null;
    }

    // if we switch main menus -> also update submenu
    if (activeSegment !== -1 && activeSegment !== activeMainIndex) {
        activeMainIndex = null;
        activeSubIndex = null;
    }
}

// calculates dwell times on hovering a menu item
function updateHoverFill(now, activeIndex) {
    for (let i = 0; i < menu.items.length; i++) {
        if (i === activeIndex && activeMainIndex == null) {     // start fill animation if cursor is inside but only if submenu is not already open
            if (hoverStartTimes[i] === null) {
                hoverStartTimes[i] = now;
                hoverTriggered[i] = false;
            }

            const elapsed = now - hoverStartTimes[i];
            hoverProgress[i] = Math.min(elapsed / HOVER_FILL_DURATION, 1);

            if (hoverProgress[i] >= 1 && !hoverTriggered[i]) {
                hoverTriggered[i] = true;
                console.log("Segment selected:", menu.items[i].label);
                activeMainIndex = i;
            }
        } else {
            // not in segment anymore -> reset
            hoverStartTimes[i] = null;
            hoverProgress[i] = 0;
            hoverTriggered[i] = false;
        }
    }
}

// resets timers if hand was recognized
function resetTimers(){
    idleStartTime = null;
    dwellStartTime = null;
    dwellProgress = 0;
}

// resets all timers if no hand was detected; checks if idle state is active and returns if dwell timer should be started
function updateIdle(handDetected, now) {
    if (idleStartTime === null && !handDetected) {
        idleStartTime = now;
        return false;
    }

    return !handDetected && now - idleStartTime >= IDLE_BEFORE_DWELL;
}

function updateDwell(now) {
    if (dwellStartTime === null) {      // if no dwell timer is running, set a new one
        dwellStartTime = now;
    }

    const elapsed = now - dwellStartTime;
    dwellProgress = Math.min(elapsed / DWELL_DURATION, 1);
}


// uses palm center to map cursor to its position
function updateCursor(results){
    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[9];              // position of cursor steered by middle of hand

    cursor.x = (1 - indexTip.x) * canvas.width; // mirrored
    cursor.y = indexTip.y * canvas.height;
    cursor.visible = true;

    drawCursor(cursor.x, cursor.y);
}

// start camera
const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 1280,
    height: 720,
});

camera.start();

function drawCursor(x, y) {
    ctx.fillStyle = "purple";
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
}

// draw a vector from menu center to cursor and get the angle of it to determine which segment the cursor is hovering on
function getCursorAngle(menu, cursor) {
    const dx = cursor.x - menu.x;
    const dy = cursor.y - menu.y;

    let angle = Math.atan2(dy, dx); // -PI .. PI

    if (angle < 0) {
        angle += Math.PI * 2;       // 0 .. 2PI
    }

    return angle;
}

// calculate which segment is hovered on based on the angle
function getActiveSegment(menu, cursor) {
    const distance = getCursorDistance(menu, cursor);

    const outerRadius = menu.radius;

    // cursor not in menu
    if (distance > outerRadius) {
        return -1;
    }

    const angle = getCursorAngle(menu, cursor);
    const angleStep = (Math.PI * 2) / menu.items.length;

    return Math.floor(angle / angleStep);
}

// calculates active subsegment by angle and distance of cursor to the center
function getActiveSubSegment(menu, cursor, mainIndex) {
    if (mainIndex === null) return -1;

    const distance = getCursorDistance(menu, cursor);
    const inner = menu.radius;
    const outer = menu.radius + 80;

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

function drawMarkingMenu(menu, activeIndex = -1) {
    const { x, y, radius, items } = menu;
    const angleStep = (Math.PI * 2) / items.length;     // angle per segment

    ctx.globalAlpha = dwellProgress > 0 ? 0.25 : 1;     // everything drawn after this is drawn with opacity 0.5
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;

    for (let i = 0; i < items.length; i++) {            // loop for each segment
        const startAngle = i * angleStep;
        const endAngle = startAngle + angleStep;

        // highlight active segment by setting the fill color AND highlight main segment if cursor is in submenu
        const cursorInSubMenu = activeMainIndex !== null && isCursorInSubMenuRing(menu, cursor); // calculate if cursor is in submenu
        const isMainHighlighted = i === activeIndex || (cursorInSubMenu && i === activeMainIndex); // highlight if: normal hover OR cursor is in submenu
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
        ctx.font = "32px sans-serif";
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
    if (activeMainIndex !== null) {
        drawSubMenu(activeMainIndex);
    }

    ctx.globalAlpha = 1;    // make sure dwell timer is drawn with opacity 1 afterwards
}

// calculates distance from menu to cursor
function getCursorDistance(menu, cursor) {
    const dx = cursor.x - menu.x;
    const dy = cursor.y - menu.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// function to draw dwell ring that appears if user is not interacting with the menu
function drawDwellRing(progress) {
    if (progress <= 0) return;

    const radius = 30;
    const lineWidth = 6;
    const margin = 20;

    const x = canvas.width - margin - radius;
    const y = margin + radius;

    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + progress * Math.PI * 2;

    ctx.strokeStyle = "rgba(0, 150, 255, 0.9)";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();
}

// draw border and fill color for submenu segments
function drawRingSegment(x, y, innerR, outerR, startAngle, endAngle) {
    ctx.beginPath();

    // outer arc
    ctx.arc(x, y, outerR, startAngle, endAngle);

    // inner arc
    ctx.arc(x, y, innerR, endAngle, startAngle, true);

    ctx.closePath();
}

// calculates angles and radius for submenu + draws them
function drawSubMenu(mainIndex) {
    const subItems = menu.items[mainIndex].subItems;
    if (!subItems) return;

    const angleStep = (Math.PI * 2) / menu.items.length;

    const startAngle = mainIndex * angleStep;
    const endAngle = startAngle + angleStep;

    const innerRadius = menu.radius;
    const outerRadius = menu.radius + 80;

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

        // hihglight active sub-segment
        if (i === activeSubIndex) {
            ctx.fillStyle = "rgba(255, 0, 255, 0.3)";
            ctx.fill();
        }
    }
}

function isCursorInSubMenuRing(menu, cursor) {
    const distance = getCursorDistance(menu, cursor);
    const inner = menu.radius;
    const outer = menu.radius + 80; // same as submenu

    return distance >= inner && distance <= outer;
}
