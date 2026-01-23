/**
 * Slider value storage
 */
export let videoLength;
export let currentLength;
export let volume;
export let brightness;
export let vibration;

/**
 * When UE sends presentation data, it is saved in videoLength and currentLength
 * @param msg
 */
export function handlePresentationData(msg){
    videoLength = msg.duration / 60;
    currentLength = msg.currentTime / 60;
}

/**
 * When UE sends slider data, it is saved in the variable which fits the target of the message.
 * @param msg
 */
export function handleDataUpdate(msg){
    switch (msg.target){
        case "volume":
            volume = msg.value;
            break;
        case "brightness":
            brightness = msg.value;
            break;
        case "vibration":
            vibration = msg.value;
            break;
        case "presentation":
            currentLength = msg.value;
            break;
    }
}