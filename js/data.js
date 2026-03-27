/**
 * Slider value storage
 */
export const sliderValueStorage = {
    videoLength: 0,
    isPlaying: false,
    actionItems: {} // { [id]: { target: string, value: number } }
};

/**
 * When UE sends presentation data, it is saved in videoLength and presentation action item (current length = 0)
 * @param msg
 */
export function handleInitialData(msg){
    sliderValueStorage.videoLength = msg.value;  // seconds
    // save currentLength with 0
    handleDataUpdate({
        target: msg.target,
        value: 0,
        id: msg.id
    });
}

/**
 * When UE sends slider data, it is saved in the variable which fits the target of the message.
 * @param msg
 */
export function handleDataUpdate(msg){
    if (msg.id == null) {
        console.warn("Slider update without id:", msg);
        return;
    }

    sliderValueStorage.actionItems[msg.id] = {
        target: msg.target,
        value: msg.value
    };

    if (msg.target === "presentation") {
        // If playback reached the end, force paused state in UI model.
        if (
            sliderValueStorage.videoLength > 0 &&
            msg.value >= sliderValueStorage.videoLength
        ) {
            sliderValueStorage.isPlaying = false;
        }
    }
}