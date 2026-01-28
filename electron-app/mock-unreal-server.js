/**
 * This file represents an alternative for the Unreal Engine server so that the application can be debugged even without UE running.
 */

const WebSocket = require("ws");

const PORT = 3000; // same port as in websocket.js

const wss = new WebSocket.Server({ port: PORT });

console.log(`Mock Unreal WebSocket Server running on ws://localhost:${PORT}`);

let videoState = {
    duration: 750,      // seconds (12:30)
    currentTime: 0,
    playing: false
};

let uiState = {
    volume: 0.3,
    brightness: 0.7,
    vibration: 0.1
};

/**
 * This is called when a websocket joined port 3000.
 */
wss.on("connection", (ws) => {
    console.log("UI connected");

    /**
     * This is what is called when the UI sends a message to this server.
     */
    ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        console.log("Received from UI:", msg);

        if (msg.action === "update" && msg.type === "slider") {
            handleSliderUpdate(msg, ws);
        }

        if (msg.action === "pressed" && msg.type === "button") {
            handlePresentationCommand(msg, ws);
        }
    });

    ws.on("close", () => {
        console.log("UI disconnected");
    });

    // Initial state (like UE when connecting) => sends general information about current volume, ...
    ws.send(JSON.stringify({
        action: "initial",
        type: "slider",
        target: "presentation",
        value: videoState.duration
    }));
    ws.send(JSON.stringify({
        action: "update",
        type: "slider",
        target: "volume",
        value: uiState.volume
    }));
    ws.send(JSON.stringify({
        action: "update",
        type: "slider",
        target: "brightness",
        value: uiState.brightness
    }));
    ws.send(JSON.stringify({
        action: "update",
        type: "slider",
        target: "vibration",
        value: uiState.vibration
    }));

    /**
     * Method that simulates that the video is running => sends new timestamp every second so that slider value increases by itself if the system is running.
     */
    setInterval(() => {
        if (videoState.playing) {
            videoState.currentTime += 0.033; // ~30 fps

            if (videoState.currentTime > videoState.duration) {
                videoState.currentTime = videoState.duration;
                videoState.playing = false;
            }
            ws.send(JSON.stringify({
                action: "update",
                type: "slider",
                target: "presentation",
                value: videoState.currentTime
            }));
        }
    }, 33);
});

/**
 * helper method that checks what kind of slider update was received from UI and also sends confirmation message back to UI ("These values were successfully sent by UI")
 * @param msg
 * @param ws
 */
function handleSliderUpdate(msg, ws) {
    let returnValue;
    if (msg.target === "presentation") {
        videoState.currentTime = msg.value * videoState.duration/60;
        returnValue = msg.value * videoState.duration/60;
    } else {
        returnValue = msg.value;
    }

    // for volume, brightness, vibration
    uiState[msg.target] = msg.value;

    ws.send(JSON.stringify({
        action: "update",
        type: "slider",
        target: msg.target,
        value: returnValue
    }));
}

/**
 * helper method that handles play/pause for video and also sends confirmation message back to UI ("These values were successfully sent by UI")
 * @param msg
 * @param ws
 * TODO needs testing
 */
function handlePresentationCommand(msg, ws) {
    if (msg.value === "play") videoState.playing = true;
    if (msg.value === "pause") videoState.playing = false;

    ws.send(JSON.stringify({
        action: "update",
        type: "slider",
        target: "presentation",
        value: videoState.currentTime
    }));
}
