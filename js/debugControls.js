import {gestureThresholds} from "./gestures.js";
import {UI_SCALE, menu, menuPosition} from "./menu.js";

const MOVE_STEP = 20;

export function initDebugControls() {

    // Load persisted values from local storage
    menuPosition.x = Number(localStorage.getItem("menuPosX")) || menuPosition.x;
    menuPosition.y = Number(localStorage.getItem("menuPosY")) || menuPosition.y;

    gestureThresholds.pinchThreshold =
        Number(localStorage.getItem("pinchThreshold")) || gestureThresholds.pinchThreshold;

    gestureThresholds.grabThreshold =
        Number(localStorage.getItem("grabThreshold")) || gestureThresholds.grabThreshold;

    gestureThresholds.openPalmThreshold =
        Number(localStorage.getItem("openPalmThreshold")) || gestureThresholds.openPalmThreshold;


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

export function handleDebugControlKey(key) {
    switch (key) {
        // scale menu with + and -
        case "+":
            resizeMenu(UI_SCALE.radiusStep);
            localStorage.setItem("menuRadius", String(menu?.radius ?? ""));
            console.log("menuRadius", menu?.radius);
            return true;
        case "-":
            resizeMenu(-UI_SCALE.radiusStep);
            localStorage.setItem("menuRadius", String(menu?.radius ?? ""));
            console.log("menuRadius", menu?.radius);
            return true;

        // move menu with arrow keys
        case "ArrowLeft":
            menuPosition.x -= MOVE_STEP;
            localStorage.setItem("menuPosX", String(menuPosition.x));
            return true;
        case "ArrowRight":
            menuPosition.x += MOVE_STEP;
            localStorage.setItem("menuPosX", String(menuPosition.x));
            return true;
        case "ArrowUp":
            menuPosition.y -= MOVE_STEP;
            localStorage.setItem("menuPosY", String(menuPosition.y));
            return true;
        case "ArrowDown":
            menuPosition.y += MOVE_STEP;
            localStorage.setItem("menuPosY", String(menuPosition.y));
            return true;

        // increase/decrease gesture thresholds
        case "p":
            gestureThresholds.pinchThreshold += 0.1;
            console.log("pinchThreshold", gestureThresholds.pinchThreshold);
            localStorage.setItem("pinchThreshold", String(gestureThresholds.pinchThreshold));
            return true;
        case "h":
            gestureThresholds.pinchThreshold -= 0.1;
            console.log("pinchThreshold", gestureThresholds.pinchThreshold);
            localStorage.setItem("pinchThreshold", String(gestureThresholds.pinchThreshold));
            return true;
        case "g":
            gestureThresholds.grabThreshold += 0.1;
            console.log("grabThreshold", gestureThresholds.grabThreshold);
            localStorage.setItem("grabThreshold", String(gestureThresholds.grabThreshold));
            return true;
        case "b":
            gestureThresholds.grabThreshold -= 0.1;
            console.log("grabThreshold", gestureThresholds.grabThreshold);
            localStorage.setItem("grabThreshold", String(gestureThresholds.grabThreshold));
            return true;
        case "o":
            gestureThresholds.openPalmThreshold += 0.1;
            console.log("openPalmThreshold", gestureThresholds.openPalmThreshold);
            localStorage.setItem("openPalmThreshold", String(gestureThresholds.openPalmThreshold));
            return true;
        case "m":
            gestureThresholds.openPalmThreshold -= 0.1;
            console.log("openPalmThreshold", gestureThresholds.openPalmThreshold);
            localStorage.setItem("openPalmThreshold", String(gestureThresholds.openPalmThreshold));
            return true;

        // clears local storage
        case "c":
            localStorage.clear();
            console.log("Localstorage cleared");
            return true;
        default:
            return false;
    }
}

function resizeMenu(delta) {
    const newRadius = menu.radius + delta;

    if (
        newRadius < UI_SCALE.minRadius ||
        newRadius > UI_SCALE.maxRadius
    ) return;

    menu.radius = newRadius;
}