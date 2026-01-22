const socket = new WebSocket("ws://localhost:8080");    // TODO port that uses UE

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
    switch (msg.type) {
        case "presentation:state":
            // duration, currentTime, playing
            break;
    }
}

