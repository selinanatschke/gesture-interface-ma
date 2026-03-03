import {gestureThresholds} from "./gestures.js";
import {UI_SCALE, menu, menuPosition} from "./menu.js";

export function initDebugControls() {

    const MOVE_STEP = 20;   // steps to rescale menu

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
        switch (e.key) {

            // scale menu with + and -
            case "+":
                resizeMenu(UI_SCALE.radiusStep);
                localStorage.setItem("menuRadius", String(menu?.radius ?? ""));
                console.log("menuRadius", menu?.radius)
                break;
            case "-":
                resizeMenu(-UI_SCALE.radiusStep);
                localStorage.setItem("menuRadius", String(menu?.radius ?? ""));
                console.log("menuRadius", menu?.radius)
                break;

            // move menu with arrow keys
            case "ArrowLeft":
                menuPosition.x -= MOVE_STEP;
                localStorage.setItem("menuPosX", String(menuPosition.x));
                break;
            case "ArrowRight":
                menuPosition.x += MOVE_STEP;
                localStorage.setItem("menuPosX", String(menuPosition.x));
                break;
            case "ArrowUp":
                menuPosition.y -= MOVE_STEP;
                localStorage.setItem("menuPosY", String(menuPosition.y));
                break;
            case "ArrowDown":
                menuPosition.y += MOVE_STEP;
                localStorage.setItem("menuPosY", String(menuPosition.y));
                break;

            // increase/decrease gesture thresholds
            case "p":
                gestureThresholds.pinchThreshold += 0.1;
                console.log("pinchThreshold", gestureThresholds.pinchThreshold);
                localStorage.setItem("pinchThreshold", String(gestureThresholds.pinchThreshold));
                break;
            case "h":
                gestureThresholds.pinchThreshold -= 0.1;
                console.log("pinchThreshold", gestureThresholds.pinchThreshold);
                localStorage.setItem("pinchThreshold", String(gestureThresholds.pinchThreshold));
                break;
            case "g":
                gestureThresholds.grabThreshold += 0.1;
                console.log("grabThreshold", gestureThresholds.grabThreshold);
                localStorage.setItem("grabThreshold", String(gestureThresholds.grabThreshold));
                break;
            case "b":
                gestureThresholds.grabThreshold -= 0.1;
                console.log("grabThreshold", gestureThresholds.grabThreshold);
                localStorage.setItem("grabThreshold", String(gestureThresholds.grabThreshold));
                break;
            case "o":
                gestureThresholds.openPalmThreshold += 0.1;
                console.log("openPalmThreshold", gestureThresholds.openPalmThreshold);
                localStorage.setItem("openPalmThreshold", String(gestureThresholds.openPalmThreshold));
                break;
            case "m":
                gestureThresholds.openPalmThreshold -= 0.1;
                console.log("openPalmThreshold", gestureThresholds.openPalmThreshold);
                localStorage.setItem("openPalmThreshold", String(gestureThresholds.openPalmThreshold));
                break;

            // clears local storage
            case "c":
                localStorage.clear();
                console.log("Localstorage cleared")
        }
    });

    function resizeMenu(delta) {
        const newRadius = menu.radius + delta;

        if (
            newRadius < UI_SCALE.minRadius ||
            newRadius > UI_SCALE.maxRadius
        ) return;

        menu.radius = newRadius;
    }
}