import {handleDataUpdate, handleInitialData, sliderValueStorage} from "./data.js";
import {syncSliderFromData} from "./slider.js";
import {getMenuDepth} from "./menu.js";

const socket = new WebSocket("ws://localhost:3000");    // TODO port that uses UE
let offlineMode = false;    // if no server is there to connect, use dummmy data
let offlineInterval = null;

let offlinePlayback = {
    duration: 750,
    currentTime: 0,
    playing: false
};

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

    if (msg.action === "update" && msg.type === "slider") {

        if (msg.target === "presentation") {
            const seconds = msg.value * offlinePlayback.duration / 60;
            offlinePlayback.currentTime = seconds;

            handleDataUpdate({
                target: "presentation",
                value: seconds
            });
        } else {
            handleDataUpdate(msg);
        }
        syncSliderFromData(msg.target);
        return
    }

    if (msg.action === "pressed" && msg.type === "button" && msg.target === "presentation"){

        // toggle state
        offlinePlayback.playing = !offlinePlayback.playing;

        // simulate server confirmation
        sliderValueStorage.isPlaying = offlinePlayback.playing;

        if (offlinePlayback.playing) {
            startOfflinePlayback();
        } else {
            stopOfflinePlayback();
        }
    }
}

/**
 * initializes dummy offline data
 */
async function initOfflineData() {
    offlinePlayback.currentTime = 0;
    offlinePlayback.playing = false;
    sliderValueStorage.isPlaying = false;

    handleInitialData(750);

    const response = await fetch("./offlineMenu.json");
    const menu = await response.json();
    handleIncomingMessage({
        action: "initial",
        type: "menu",
        value: menu
    });
    handleDataUpdate({target: "volume", value: 0.5});
    handleDataUpdate({target: "brightness", value: 0.7});
    handleDataUpdate({target: "vibration", value: 0.2});
}

/**
 * Simulates play/pause in offline mode
 */
function startOfflinePlayback() {
    if (offlineInterval) return;

    offlineInterval = setInterval(() => {

        if (!offlinePlayback.playing) return;

        offlinePlayback.currentTime += 0.033;

        if (offlinePlayback.currentTime >= offlinePlayback.duration) {
            offlinePlayback.currentTime = offlinePlayback.duration;
            offlinePlayback.playing = false;
            stopOfflinePlayback();
        }

        handleDataUpdate({
            target: "presentation",
            value: offlinePlayback.currentTime
        });
    }, 33);
}

function stopOfflinePlayback() {
    if (offlineInterval) {
        clearInterval(offlineInterval);
        offlineInterval = null;
    }
}

/**
 * handles incoming messages from websocket
 * @param msg
 */
function handleIncomingMessage(msg) {
    console.log("received message from UE: ", msg);

    // update menu structure
    if (msg.action === "initial" && msg.type === "menu") {
        const depth = getMenuDepth(msg.value["items"]);
        if (depth > 4){
            console.warn("The menu depth exceeds 4 levels. For optimal usability, a maximum of 4 levels is recommended.")
        }

        import("./menu.js").then(module => {
            module.setMenu(msg.value);
        });
        return;
    }

    // inital message that sends total video length in seconds and sets currentTime to 0
    if (msg.action === "initial" && msg.type === "slider" && msg.target === "presentation") {
        handleInitialData(msg.value);
        return;
    }

    // 
    if (msg.action === "update" && msg.type === "slider") {
        handleDataUpdate({
            target: msg.target,
            value: msg.value
        });

        syncSliderFromData(msg.target);
    }

    if (msg.action === "pressed" && msg.type === "button") {
        sliderValueStorage.isPlaying = msg.value === "play";
    }
}


