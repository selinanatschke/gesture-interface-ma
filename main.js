const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

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
        { label: "A" },
        { label: "B" },
        { label: "C" },
    ]
};

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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let activeSegment = -1;

    if (results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[9];              // position of cursor steered by middle of hand

        cursor.x = (1 - indexTip.x) * canvas.width; // mirrored
        cursor.y = indexTip.y * canvas.height;
        cursor.visible = true;

        activeSegment = getActiveSegment(menu, cursor);

        drawCursor(cursor.x, cursor.y);
    }

    drawMarkingMenu(menu, activeSegment);
});

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


function drawMarkingMenu(menu, activeIndex = -1) {
    const { x, y, radius, items } = menu;
    const angleStep = (Math.PI * 2) / items.length;     // angle per segment

    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;

    for (let i = 0; i < items.length; i++) {            // loop for each segment
        const startAngle = i * angleStep;
        const endAngle = startAngle + angleStep;

        // highlight active segment by setting the fill color
        if (i === activeIndex) {
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
    }
}

// calculates distance from menu to cursor
function getCursorDistance(menu, cursor) {
    const dx = cursor.x - menu.x;
    const dy = cursor.y - menu.y;
    return Math.sqrt(dx * dx + dy * dy);
}
