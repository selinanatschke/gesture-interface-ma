const { app, BrowserWindow, globalShortcut, screen } = require('electron')
const CALIBRATION_MODE_TOGGLE_ACCELERATOR = "F10";
const DEFAULT_SCREEN_MODE = "all-displays-default";
let calibrationModeEnabled = false;
let calibrationKeysRegistered = false;
const windows = new Set(); // saves all open windows + necessary o that all calibration toggles and key shortcuts work for all windows

const CALIBRATION_KEYS = [
    { accelerators: ["Up"], key: "ArrowUp", message: `Menu moved up by 20px.`},
    { accelerators: ["Down"], key: "ArrowDown", message: `Menu moved down by 20px.` },
    { accelerators: ["Left"], key: "ArrowLeft", message: `Menu moved up left 20px.`},
    { accelerators: ["Right"], key: "ArrowRight", message: `Menu moved up right 20px.` },
    { accelerators: ["=", "numadd", "Shift+="], key: "+", message: "Menu radius increased by 20px." },
    { accelerators: ["-", "numsub"], key: "-", message: "Menu radius decreased by 20px." },
    { accelerators: ["P"], key: "p", message: "Pinch threshold increased by 0.1." },
    { accelerators: ["H"], key: "h", message: "Pinch threshold decreased by 0.1." },
    { accelerators: ["G"], key: "g", message: "Grab threshold increased by 0.1." },
    { accelerators: ["B"], key: "b", message: "Grab threshold decreased by 0.1." },
    { accelerators: ["O"], key: "o", message: "Open Palm threshold increased by 0.1." },
    { accelerators: ["M"], key: "m", message: "Open Palm threshold decreased by 0.1." },
    { accelerators: ["C"], key: "c", message: `You cleared the calibration settings. This will be visible after restarting the electron application.` },
    { accelerators: ["F"], key: "f", message: "Offline mode enabled."}
];

// reads arguments from npm command like "--screens=1,2" and "--cams=2,0"
// result is object like { screens: [1,2], cameraIndices: [2,0] }
function parseCliArgs(argv) {
    const config = {
        screens: DEFAULT_SCREEN_MODE,
        cameraIndices: []
    };

    console.log("argv", argv)

    const parseNonNegativeIntList = (value) => value
        .split(",")
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((number) => Number.isInteger(number) && number >= 0);

    var args2 = process.argv.slice(2);
console.log("args2", args2)

    argv.forEach((arg) => {
        console.log("arg", arg)
        if (!arg.startsWith("--")) return;

        const [rawKey, rawValue = ""] = arg.slice(2).split("=");
        if (!rawKey) return;

        if (rawKey === "screens") {
            const parsed = parseNonNegativeIntList(rawValue);
            if (parsed.length > 0) {
                config.screens = parsed;
            }
            return;
        }

        if (rawKey === "cams") {
            config.cameraIndices = parseNonNegativeIntList(rawValue);
        }
    });

    return config;
}

// calls javascript function from debugControl.js
function triggerDebugControl(win, key) {
    return win.webContents.executeJavaScript(
        `window.handleDebugControlKey && window.handleDebugControlKey(${JSON.stringify(key)});`,
        true
    );
}

function formatCalibrationState(state) {
    if (!state || typeof state !== "object") return "No state returned";

    const x = state.menuPosition?.x;
    const y = state.menuPosition?.y;
    const radius = state.menuRadius;
    const pinch = state.thresholds?.pinch;
    const grab = state.thresholds?.grab;
    const openPalm = state.thresholds?.openPalm;

    return `Current Calibration: position=(${x}, ${y}), radius=${radius}, pinch=${pinch}, grab=${grab}, openPalm=${openPalm}`;
}

function getOpenWindows() {
    return [...windows].filter((win) => !win.isDestroyed());
}

// send information that calibration mode was enabled/disabled to UI
function notifyRendererCalibrationMode(win) {
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) {
        return;
    }

    // sets JavaScript variable calibrationModeEnabled
    const enabled = Boolean(calibrationModeEnabled);
    win.webContents.executeJavaScript(
        `window.calibrationModeEnabled = ${enabled}; window.dispatchEvent(new CustomEvent("calibration-mode-changed", { detail: { enabled: ${enabled} } }));`,
        true
    ).catch((error) => {
        console.error("Failed to sync calibration mode to renderer", error);
    });
}

// applies calibration mode => enables/disables mouse events for each window
function applyCalibrationModeToAllWindows() {
    getOpenWindows().forEach((win) => {
        if (!win || win.isDestroyed()) {
            return;
        }

        if (calibrationModeEnabled) {
            // Calibration mode: interact with full overlay (camera picker etc.)
            win.setIgnoreMouseEvents(false);
        } else {
            // Runtime mode: pass clicks through to underlying apps.
            win.setIgnoreMouseEvents(true, { forward: true });
        }

        notifyRendererCalibrationMode(win);
    });
}

// keys for calibration in electron will only be registered if the calibration mode is on (otherwise in underlying applications the keys are not arriving)
function registerCalibrationKeys() {
    if (calibrationKeysRegistered) {
        return;
    }

    CALIBRATION_KEYS.forEach(({ accelerators, key, message }) => {
        accelerators.forEach((accelerator) => {
            globalShortcut.register(accelerator, async () => {
                try {
                    const openWindows = getOpenWindows();
                    const states = await Promise.allSettled(openWindows.map((win) => triggerDebugControl(win, key)));
                    states.forEach((entry, index) => {
                        const stateText = entry.status === "fulfilled"
                            ? formatCalibrationState(entry.value)
                            : `Failed: ${entry.reason?.message ?? String(entry.reason)}`;
                        console.log(`Window ${index}: Key "${key}": ${message}       ${stateText}`);
                    });
                } catch (error) {
                    console.error(`Calibration key "${key}" failed`, error);
                }
            });
        });
    });

    calibrationKeysRegistered = true;
    console.log("Calibration keys registered");
}

// if calibration mode is off, the calibration keys have to be unregistered to not be "listened to" anymore
function unregisterCalibrationKeys() {
    if (!calibrationKeysRegistered) {
        return;
    }

    CALIBRATION_KEYS.forEach(({ accelerators }) => {
        accelerators.forEach((accelerator) => {
            globalShortcut.unregister(accelerator);
        });
    });

    calibrationKeysRegistered = false;
    console.log("Calibration keys unregistered");
}

// registers key for enabling/disabling calibration mode and then decides, whether keys must be registered or not
function handleKeyRegistration() {
    console.log(`CalibrationMode ${calibrationModeEnabled ? "ENABLED" : "DISABLED"} (toggle with ${CALIBRATION_MODE_TOGGLE_ACCELERATOR})`);

    globalShortcut.register(CALIBRATION_MODE_TOGGLE_ACCELERATOR, () => {
        calibrationModeEnabled = !calibrationModeEnabled;
        console.log(`CalibrationMode ${calibrationModeEnabled ? "ENABLED" : "DISABLED"}`);
        applyCalibrationModeToAllWindows();

        if (calibrationModeEnabled) {
            registerCalibrationKeys();
        } else {
            unregisterCalibrationKeys();
        }
    });
}

// gets all monitors from electron via screen.getAllDisplays()
// selects either primary monitor, all monitors or certain indices
function selectDisplays(displayConfig) {
    const allDisplays = screen.getAllDisplays();

    // return all
    if (displayConfig === DEFAULT_SCREEN_MODE) {
        return allDisplays;
    }

    // return certain
    if (Array.isArray(displayConfig)) {
        return displayConfig
            .map((index) => allDisplays[index])
            .filter(Boolean);
    }

    //return primary
    return [screen.getPrimaryDisplay()];
}

// loads web page into a new BrowserWindow instance (creates for each display a browser window)
function createWindowForDisplay(display, displayIndex, cameraIndex) {
    const { x, y, width, height } = display.bounds;

    const win = new BrowserWindow({
        x,
        y,
        width,
        height,
        webPreferences: {
            sandbox: false   // important for camera
        },
        transparent: true,
        frame: false,
        fullscreen: true,
        alwaysOnTop: true,
        focusable: false    // does not steal focus when starting the application
    });

    const query = {
        displayId: String(display.id),
        displayIndex: String(displayIndex)
    };

    if (Number.isInteger(cameraIndex) && cameraIndex >= 0) {
        query.cameraIndex = String(cameraIndex);
    }

    win.loadFile("../index.html", { query }); // loads html index and query string e.g. "?displayId=12345&displayIndex=0&cameraIndex=2"
    win.webContents.openDevTools();
    applyCalibrationModeToAllWindows();
    win.webContents.on("did-finish-load", () => {
        applyCalibrationModeToAllWindows();
    });

    windows.add(win);
    win.on("closed", () => {
        windows.delete(win);
    });
}

function createWindowsFromCliConfig(cliConfig) {
    const selectedDisplays = selectDisplays(cliConfig.screens);
    if (selectedDisplays.length === 0) {
        console.warn("No displays matched CLI selection, falling back to primary display.");
        selectedDisplays.push(screen.getPrimaryDisplay());
    }

    selectedDisplays.forEach((display, index) => {
        const cameraIndex = cliConfig.cameraIndices[index];
        createWindowForDisplay(display, index, cameraIndex);
    });

    const selectedDisplayIds = selectedDisplays.map((display) => display.id).join(", ");
    const selectedCameras = cliConfig.cameraIndices.join(", ") || "auto";
    console.log(`Started windows on display IDs: ${selectedDisplayIds}`);
    console.log(`Camera mapping by window index: ${selectedCameras}`);
}

process.argv.forEach(function (val, index, array) {
    console.log("CLI ----", index + ': ' + val);
});
console.log("TEST ", process.argv.slice(2))
const cliConfig = parseCliArgs(process.argv.slice(2));

/**
 * is called when electron app is started
 * -> opens window(s)
 * -> starts websocket server
 */
app.whenReady().then(() => {
    handleKeyRegistration();
    createWindowsFromCliConfig(cliConfig);

    app.on("activate", () => {
        if (getOpenWindows().length === 0) {
            createWindowsFromCliConfig(cliConfig);
        }
    });
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});
