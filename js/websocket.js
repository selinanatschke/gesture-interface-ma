import {currentLength, handleDataUpdate, handlePresentationData} from "./data.js";
import {syncSliderFromData, uiMode} from "./slider.js";
import {isPinched} from "./gestures.js";

const socket = new WebSocket("ws://localhost:3000");    // TODO port that uses UE
let offlineMode = false;    // if no server is there to connect, use dummmy data
let dummyInterval = null;

socket.onopen = () => {
    console.log("WebSocket connected");
};

// receives messages from UE
socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleIncomingMessage(msg);
};

socket.onerror = (err) => {
    console.error("WebSocket error:", err);
    offlineMode = true;
    initOfflineData();
};

socket.onclose = () => {
    console.warn("WebSocket closed");
    offlineMode = true;
};

/** Method that sends messages in json format via websocket
 * Example slider message:  sendMessage({ type: "slider:update", target: sliderConfig.type, value: sliderValue });
 * Example pause/play:      sendMessage({ type: "presentation:command", action: "play" });
 * @param message
 */
export function sendMessage(message) {
    if (socket.readyState === WebSocket.OPEN && !offlineMode) {
        socket.send(JSON.stringify(message));
    } else {
        handleOfflineMessage(message);
    }
}

/**
 * This method mocks sending messages to a server but in reality it just sends the same message back to simulate a succuessful use.
 * It is only for testing purposes to use it when no server is available (not even a mock server).
 * @param msg
 */
function handleOfflineMessage(msg) {
    console.log("Offline mode message:", msg);

    switch (msg.type) {
        case "slider:update":
            if (msg.target === "presentation") {
                const durationInSeconds = 750;
                const seconds = msg.value * durationInSeconds / 60;

                handleDataUpdate({
                    target: "presentation",
                    value: seconds
                });
            } else {
                handleDataUpdate(msg);
            }
            syncSliderFromData(msg.target);
            break;

        case "presentation:command":
            // simple fake play/pause TODO needs testing
            if (msg.action === "play") {
                startDummyPlayback();
            }
            break;
    }
}

/**
 * initializes dummy offline data
 */
function initOfflineData() {
    handlePresentationData({
        duration: 750,
        currentTime: 0
    });

    handleDataUpdate({ target: "volume", value: 0.5 });
    handleDataUpdate({ target: "brightness", value: 0.7 });
    handleDataUpdate({ target: "vibration", value: 0.2 });
}

/**
 * Simulates play/pause in offline mode (TODO test)
 */
function startDummyPlayback() {
    if (dummyInterval) return;

    dummyInterval = setInterval(() => {
        handlePresentationData({
            duration: 750,
            currentTime: (currentLength * 60) + 0.033
        });
    }, 33);
}

/**
 * handles incoming messages from websocket
 * @param msg
 */
function handleIncomingMessage(msg) {
    console.log("received message from UE: ", msg)
    switch (msg.type) {
        case "presentation:state":
            if(!(uiMode.current === "slider" && isPinched)){    // engine updates are ignored as long as user modifies slider
                handlePresentationData(msg);
                syncSliderFromData("presentation")
            }
            break;
        case "slider:update":
            handleDataUpdate(msg);
            syncSliderFromData(msg.target)
            break;
        case "presentation:command":
            // TODO
            break;
    }
}

