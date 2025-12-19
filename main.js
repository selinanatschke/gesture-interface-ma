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
    drawMarkingMenu(menu);

    if (results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[9];              // position of cursor steered by middle of hand

        cursor.x = (1 - indexTip.x) * canvas.width; // mirrored
        cursor.y = indexTip.y * canvas.height;
        cursor.visible = true;

        drawCursor(cursor.x, cursor.y);
    }
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

function drawMarkingMenu(menu) {
    const { x, y, radius, items } = menu;
    const angleStep = (Math.PI * 2) / items.length;     // angle per segment

    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;

    for (let i = 0; i < items.length; i++) {            // loop for each segment
        const startAngle = i * angleStep;
        const endAngle = startAngle + angleStep;

        // draw segment
        ctx.beginPath();
        ctx.moveTo(x, y);                               // line starts in the middle
        ctx.arc(x, y, radius, startAngle, endAngle);    // draw arc from startAngle to endAngle
        ctx.closePath();                                // line back to the middle
        ctx.stroke();

        // calculate label position
        const midAngle = startAngle + angleStep / 2;
        const labelX = x + Math.cos(midAngle) * radius * 0.6;
        const labelY = y + Math.sin(midAngle) * radius * 0.6;

        ctx.fillStyle = "black";                        // color of label
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(items[i].label, labelX, labelY);

        // ctx.fillStyle = isActive ? "rgba(255,255,255,0.2)" : "transparent";     // highlight of a segment

    }
}