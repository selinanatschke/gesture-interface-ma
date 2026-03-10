const { app, BrowserWindow, globalShortcut  } = require('electron')
const CALIBRATION_MODE_TOGGLE_ACCELERATOR = "F10";
let calibrationModeEnabled = false;
let calibrationKeysRegistered = false;

const CALIBRATION_KEYS = [
    { accelerators: ["Up"], key: "ArrowUp" },
    { accelerators: ["Down"], key: "ArrowDown" },
    { accelerators: ["Left"], key: "ArrowLeft" },
    { accelerators: ["Right"], key: "ArrowRight" },
    { accelerators: ["=", "numadd", "Shift+="], key: "+" },
    { accelerators: ["-", "numsub"], key: "-" },
    { accelerators: ["P"], key: "p" },
    { accelerators: ["H"], key: "h" },
    { accelerators: ["G"], key: "g" },
    { accelerators: ["B"], key: "b" },
    { accelerators: ["O"], key: "o" },
    { accelerators: ["M"], key: "m" },
    { accelerators: ["C"], key: "c" }
];

// calls javascript function from debugControl.js
function triggerDebugControl(win, key) {
    return win.webContents.executeJavaScript(
        `window.handleDebugControlKey && window.handleDebugControlKey(${JSON.stringify(key)});`,
        true
    );
}

// keys for calibration in electron will only be registered if the calibration mode is on (otherwise in underlying applications the keys are not arriving)
function registerCalibrationKeys(win) {
    if (calibrationKeysRegistered) {
        return;
    }

    CALIBRATION_KEYS.forEach(({ accelerators, key }) => {
        accelerators.forEach((accelerator) => {
            globalShortcut.register(accelerator, () => {
                console.log(`Key "${key}"`);
                triggerDebugControl(win, key);
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

