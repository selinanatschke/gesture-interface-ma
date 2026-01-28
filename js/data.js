/**
 * Slider value storage
 */
export const sliderValueStorage = {
    videoLength: 0,
    currentLength: 0,
    volume: 0,
    brightness: 0,
    vibration: 0
};

/**
 * When UE sends presentation data, it is saved in videoLength and currentLength
 * @param totalVideoLength
 */
export function handleInitialData(totalVideoLength){
    sliderValueStorage.videoLength = totalVideoLength / 60;
    sliderValueStorage.currentLength = 0;
}

/**
 * When UE sends slider data, it is saved in the variable which fits the target of the message.
 * @param msg
 */
export function handleDataUpdate(msg){
    switch (msg.target){
        case "volume":
            sliderValueStorage.volume = msg.value;
            break;
        case "brightness":
            sliderValueStorage.brightness = msg.value;
            break;
        case "vibration":
            sliderValueStorage.vibration = msg.value;
            break;
        case "presentation":
            sliderValueStorage.currentLength = msg.value;
            break;
    }
}