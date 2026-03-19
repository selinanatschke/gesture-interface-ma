const { app, BrowserWindow, globalShortcut  } = require('electron')
const CALIBRATION_MODE_TOGGLE_ACCELERATOR = "F10";
let calibrationModeEnabled = false;
let calibrationKeysRegistered = false;

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
    { accelerators: ["C"], key: "c", message: `You cleared the calibration settings. This will be visible after restarting the electron application.` }
];

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

// keys for calibration in electron will only be registered if the calibration mode is on (otherwise in underlying applications the keys are not arriving)
function registerCalibrationKeys(win) {
    if (calibrationKeysRegistered) {
        return;
    }

    CALIBRATION_KEYS.forEach(({ accelerators, key, message }) => {
        accelerators.forEach((accelerator) => {
            globalShortcut.register(accelerator, async () => {
                try {
                    const state = await triggerDebugControl(win, key);
                    console.log(`Key "${key}": ${message}       ${formatCalibrationState(state)}`);
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
function handleKeyRegistration(win) {
    console.log(`CalibrationMode ${calibrationModeEnabled ? "ENABLED" : "DISABLED"} (toggle with ${CALIBRATION_MODE_TOGGLE_ACCELERATOR})`);

    globalShortcut.register(CALIBRATION_MODE_TOGGLE_ACCELERATOR, () => {
        calibrationModeEnabled = !calibrationModeEnabled;
        console.log(`CalibrationMode ${calibrationModeEnabled ? "ENABLED" : "DISABLED"}`);

        if (calibrationModeEnabled) {
            registerCalibrationKeys(win);
        } else {
            unregisterCalibrationKeys();
        }
    });
}

// loads web page into a new BrowserWindow instance
const createWindow = () => {
    const win = new BrowserWindow({
        webPreferences: {
            sandbox: false   // important for camera
        },
        transparent: true,
        frame: false,
        fullscreen: true,
        alwaysOnTop: true,
        focusable: false    // does not steal focus when starting the application
    })

    win.loadFile('../index.html')
    win.webContents.on("did-finish-load", () => {
        handleKeyRegistration(win);
    });
    win.webContents.openDevTools();
    win.setIgnoreMouseEvents(true, { forward: true });
}

/**
 * is called when electron app is started
 * -> opens window
 * -> starts websocket server
 */
app.whenReady().then(() => {
    createWindow()
})

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});

