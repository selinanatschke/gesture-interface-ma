/**
 * Slider value storage
 */
export const sliderValueStorage = {
    videoLength: 0,
    isPlaying: false,
    actionItems: {} // { [id]: { target: string, value: number } }
};

/**
 * When UE sends presentation data, it is saved in videoLength and currentLength
 * @param totalVideoLength
 */
export function handleInitialData(totalVideoLength){
    sliderValueStorage.videoLength = totalVideoLength;  // seconds
    sliderValueStorage.currentLength = 0;               // seconds
}

/**
 * When UE sends slider data, it is saved in the variable which fits the target of the message.
 * @param msg
 */
export function handleDataUpdate(msg){
    if (msg.target === "presentation") {
        sliderValueStorage.currentLength = msg.value;

        // If playback reached the end, force paused state in UI model.
        if (
            sliderValueStorage.videoLength > 0 &&
            sliderValueStorage.currentLength >= sliderValueStorage.videoLength
        ) {
            sliderValueStorage.currentLength = sliderValueStorage.videoLength;
            sliderValueStorage.isPlaying = false;
        }
        return;
    }

    if (msg.id == null) {
        console.warn("Slider update without id:", msg);
        return;
    }

    sliderValueStorage.actionItems[msg.id] = {
        target: msg.target,
        value: msg.value
    };
}