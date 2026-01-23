import {handleDataUpdate, handlePresentationData} from "./data.js";
import {syncSliderFromData, uiMode} from "./slider.js";
import {isPinched} from "./gestures.js";

const socket = new WebSocket("ws://localhost:3000");    // TODO port that uses UE

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
};

socket.onclose = () => {
    console.warn("WebSocket closed");
};

/** Method that sends messages in json format via websocket
 * Example slider message:  sendMessage({ type: "slider:update", target: sliderConfig.type, value: sliderValue });
 * Example pause/play:      sendMessage({ type: "presentation:command", action: "play" });
 * @param message
 */
export function sendMessage(message) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
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

