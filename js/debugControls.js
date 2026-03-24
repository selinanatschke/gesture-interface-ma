import {DEFAULT_GESTURE_THRESHOLDS, gestureThresholds} from "./gestures.js";
import {UI_SCALE, menu, menuPosition} from "./menu.js";

const MOVE_STEP = 20;
const CALIBRATION_STORAGE_KEYS = [
    "menuPosX",
    "menuPosY",
    "menuRadius",
    "pinchThreshold",
    "grabThreshold",
    "openPalmThreshold"
];

export function initDebugControls() {
    menuPosition.x = getStoredNumber("menuPosX", menuPosition.x);
    menuPosition.y = getStoredNumber("menuPosY", menuPosition.y);
    gestureThresholds.pinchThreshold = getStoredNumber("pinchThreshold", gestureThresholds.pinchThreshold);
    gestureThresholds.grabThreshold = getStoredNumber("grabThreshold", gestureThresholds.grabThreshold);
    gestureThresholds.openPalmThreshold = getStoredNumber("openPalmThreshold", gestureThresholds.openPalmThreshold);

    /**
     * This method uses keyboard keys to scale the radius of the menu and move the menu.
     * This method can also increase/decrease gesture detection thresholds
     * This is only for testing and debugging and NO user should ever use this.
     */
    window.addEventListener("keydown", (e) => {
        handleDebugControlKey(e.key);
    });
    window.handleDebugControlKey = handleDebugControlKey;   // function is globally available for the browser window => can be called from electron via win.webContents.executeJavascript("window.handleDebugControlKey('p')")
}

// Note: has return value to print information in electron console.
export function handleDebugControlKey(key) {
    let handled = true;

    switch (key) {
        // scale menu with + and -
        case "+":
            resizeMenu(UI_SCALE.radiusStep);
            localStorage.setItem("menuRadius", String(menu?.radius ?? ""));
            console.log("Menu radius increased by 20px. Current radius: ", menu?.radius);
            break;
        case "-":
            resizeMenu(-UI_SCALE.radiusStep);
            localStorage.setItem("menuRadius", String(menu?.radius ?? ""));
            console.log("Menu radius decreased by 20px. Current radius: ", menu?.radius);
            break;

        // move menu with arrow keys
        case "ArrowLeft":
            menuPosition.x -= MOVE_STEP;
            localStorage.setItem("menuPosX", String(menuPosition.x));
            console.log("Menu moved left by 20px. Current position: ", menuPosition);
            break;
        case "ArrowRight":
            menuPosition.x += MOVE_STEP;
            localStorage.setItem("menuPosX", String(menuPosition.x));
            console.log("Menu moved right by 20px. Current position: ", menuPosition);
            break;
        case "ArrowUp":
            menuPosition.y -= MOVE_STEP;
            localStorage.setItem("menuPosY", String(menuPosition.y));
            console.log("Menu moved up by 20px. Current position: ", menuPosition);
            break;
        case "ArrowDown":
            menuPosition.y += MOVE_STEP;
            localStorage.setItem("menuPosY", String(menuPosition.y));
            console.log("Menu moved down by 20px. Current position: ", menuPosition);
            break;

        // increase/decrease gesture thresholds
        case "p":
            gestureThresholds.pinchThreshold += 0.1;
            console.log("PinchThreshold increased by 0.1. Current threshold: ", gestureThresholds.pinchThreshold);
            localStorage.setItem("pinchThreshold", String(gestureThresholds.pinchThreshold));
            break;
        case "h":
            gestureThresholds.pinchThreshold -= 0.1;
            console.log("PinchThreshold decreased by 0.1. Current threshold: ", gestureThresholds.pinchThreshold);
            localStorage.setItem("pinchThreshold", String(gestureThresholds.pinchThreshold));
            break;
        case "g":
            gestureThresholds.grabThreshold += 0.1;
            console.log("GrabThreshold increased by 0.1. Current threshold: ", gestureThresholds.grabThreshold);
            localStorage.setItem("grabThreshold", String(gestureThresholds.grabThreshold));
            break;
        case "b":
            gestureThresholds.grabThreshold -= 0.1;
            console.log("GrabThreshold decreased by 0.1. Current threshold: ", gestureThresholds.grabThreshold);
            localStorage.setItem("grabThreshold", String(gestureThresholds.grabThreshold));
            break;
        case "o":
            gestureThresholds.openPalmThreshold += 0.1;
            console.log("OpenPalmThreshold increased by 0.1. Current threshold: ", gestureThresholds.openPalmThreshold);
            localStorage.setItem("openPalmThreshold", String(gestureThresholds.openPalmThreshold));
            break;
        case "m":
            gestureThresholds.openPalmThreshold -= 0.1;
            console.log("OpenPalmThreshold decreased by 0.1. Current threshold: ", gestureThresholds.openPalmThreshold);
            localStorage.setItem("openPalmThreshold", String(gestureThresholds.openPalmThreshold));
            break;
        // clears local storage
        case "c":
            CALIBRATION_STORAGE_KEYS.forEach((storageKey) => localStorage.removeItem(storageKey));
            localStorage.removeItem("openPalmFrontalThreshold");

            gestureThresholds.pinchThreshold = DEFAULT_GESTURE_THRESHOLDS.pinchThreshold;
            gestureThresholds.grabThreshold = DEFAULT_GESTURE_THRESHOLDS.grabThreshold;
            gestureThresholds.openPalmThreshold = DEFAULT_GESTURE_THRESHOLDS.openPalmThreshold;

            menuPosition.x = window.innerWidth / 2;
            menuPosition.y = window.innerHeight / 2;

            if (menu) {
                menu.radius = getMenuDefaultRadius();
            }

            console.log("Calibration reset applied immediately (position, radius, thresholds).");
            break;
        case "f":
            window.dispatchEvent(new CustomEvent("force-offline-mode")); // sends custom event so that websocket can listen to it
            break;
        default:
            handled = false;
            break;
    }

    return {
        handled,
        key,
        menuPosition: {
            x: menuPosition.x,
            y: menuPosition.y
        },
        menuRadius: menu?.radius ?? null,
        thresholds: {
            pinch: gestureThresholds.pinchThreshold,
            grab: gestureThresholds.grabThreshold,
            openPalm: gestureThresholds.openPalmThreshold
        }
    };
}

function resizeMenu(delta) {
    const newRadius = menu.radius + delta;

    if (
        newRadius < UI_SCALE.minRadius ||
        newRadius > UI_SCALE.maxRadius
    ) return;

    menu.radius = newRadius;
}

function getStoredNumber(key, fallback) {
    const rawValue = localStorage.getItem(key); // comes as string from localStorage
    if (rawValue === null || rawValue === "") return fallback;

    const parsedValue = Number(rawValue);       // converts string into number
    return Number.isFinite(parsedValue) ? parsedValue : fallback;   // makes sure value is a valid number
}

function getMenuDefaultRadius() {
    if (Number.isFinite(menu?.defaultRadius)) return menu.defaultRadius;
    if (Number.isFinite(menu?.radius)) return menu.radius;
    return UI_SCALE.minRadius;
}
