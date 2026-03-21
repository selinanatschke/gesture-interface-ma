const DEVICE_ENUMERATION_RETRIES = 4;
const DEVICE_ENUMERATION_DELAY_MS = 250;

// atops all tracks of a MediaStream to fully release the active camera device
function stopStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
}

// waits for the given number of milliseconds, used between device enumeration retries
function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

// builds and draws the camera picker UI and returns its key elements
function createPickerUi() {
    const root = document.createElement("div");
    root.id = "camera-picker";
    root.style.position = "fixed";
    root.style.top = "16px";
    root.style.left = "16px";
    root.style.padding = "10px 12px";
    root.style.background = "rgba(20, 20, 20, 0.82)";
    root.style.border = "1px solid rgba(255, 255, 255, 0.25)";
    root.style.borderRadius = "10px";
    root.style.color = "#fff";
    root.style.fontFamily = "RobotoCondensed, sans-serif";
    root.style.fontSize = "14px";
    root.style.minWidth = "260px";

    const title = document.createElement("div");
    title.textContent = "Kamera auswaehlen";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "6px";

    const select = document.createElement("select");
    select.style.width = "100%";
    select.style.marginBottom = "6px";
    select.style.padding = "4px";
    select.style.borderRadius = "6px";
    select.style.border = "1px solid #888";
    select.style.background = "#111";
    select.style.color = "#fff";

    const status = document.createElement("div");
    status.textContent = "Initialisiere Kamera ...";
    status.style.opacity = "0.85";

    root.appendChild(title);
    root.appendChild(select);
    root.appendChild(status);
    document.body.appendChild(root);

    return { root, select, status };
}

// reads available video input devices; optionally retries to catch delayed device registration
async function readVideoInputs({ useRetry = false } = {}) {
    const byDeviceId = new Map();
    const maxAttempts = useRetry ? DEVICE_ENUMERATION_RETRIES + 1 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((device) => device.kind === "videoinput");
        videoInputs.forEach((device) => {
            if (device?.deviceId) {
                byDeviceId.set(device.deviceId, device);
            }
        });

        if (useRetry && attempt < maxAttempts - 1) {
            await wait(DEVICE_ENUMERATION_DELAY_MS);
        }
    }

    return [...byDeviceId.values()];
}

// initializes camera selection, visibility behavior, stream switching, and per-frame processing
export async function initCameraSelector(video, onFrame, options = {}) {
    const width = options.width ?? 1280;
    const height = options.height ?? 720;
    const preferredCameraIndex =
        Number.isInteger(options.preferredCameraIndex) && options.preferredCameraIndex >= 0
            ? options.preferredCameraIndex
            : null;

    const { root, select, status } = createPickerUi();
    let currentStream = null;
    let activeDeviceId = null;
    let processingFrame = false;

    // Shows or hides the picker depending on calibration mode state.
    const setVisible = (visible) => {
        root.style.display = visible ? "block" : "none";
    };

    setVisible(Boolean(window.calibrationModeEnabled));
    window.addEventListener("calibration-mode-changed", (event) => {
        const enabled = Boolean(event?.detail?.enabled);
        setVisible(enabled);
    });

    // runs a continuous frame loop and forwards frames to the provided processing callback
    const renderLoop = async () => {
        if (!processingFrame) {
            processingFrame = true;
            try {
                await onFrame();
            } catch (error) {
                // keep render loop alive even if frame processing fails temporarily
                console.error("Frame processing failed", error);
            } finally {
                processingFrame = false;
            }
        }
        requestAnimationFrame(renderLoop);
    };

    // refreshes the dropdown entries and chooses the best initial device (preferred id/index/fallback)
    const populateSelect = async ({ preferredDeviceId = null, preferredIndex = null, useRetry = false } = {}) => {
        const videoInputs = await readVideoInputs({ useRetry });
        select.innerHTML = "";

        videoInputs.forEach((device, index) => {
            const option = document.createElement("option");
            option.value = device.deviceId;
            option.textContent = device.label || `Kamera ${index + 1}`;
            select.appendChild(option);
        });

        if (videoInputs.length === 0) {
            status.textContent = "Keine Kamera gefunden.";
            return null;
        }

        // set in the beginning or when user changes selected camera
        const hasPreferredDeviceId = videoInputs.some((device) => device.deviceId === preferredDeviceId);
        let chosen = null;

        if (hasPreferredDeviceId) {
            chosen = preferredDeviceId;
        } else if (Number.isInteger(preferredIndex) && preferredIndex >= 0 && preferredIndex < videoInputs.length) {
            chosen = videoInputs[preferredIndex].deviceId;
        } else {
            chosen = videoInputs[0].deviceId;
        }

        select.value = chosen;
        status.textContent = `${videoInputs.length} Kamera(s) gefunden.`;
        return chosen;
    };

    // starts the selected camera stream and binds it to the hidden video element
    const startCamera = async (deviceId) => {
        status.textContent = "Starte Kamera ...";
        stopStream(currentStream);

        const constraints = {
            video: {
                deviceId: { exact: deviceId },
                width: { ideal: width },
                height: { ideal: height }
            },
            audio: false
        };

        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;
        await video.play();

        activeDeviceId = deviceId;
        status.textContent = "Kamera aktiv.";
    };

    // first permission prompt; then labels/device ids are reliable
    try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        stopStream(permissionStream);
    } catch (error) {
        status.textContent = "Kamerazugriff verweigert.";
        throw error;
    }

    const firstDeviceId = await populateSelect({
        preferredDeviceId: null,
        preferredIndex: preferredCameraIndex,
        useRetry: true
    });
    if (!firstDeviceId) return;

    await startCamera(firstDeviceId);

    // run one late refresh to catch devices that appear after initial startup
    await populateSelect({ preferredDeviceId: activeDeviceId });

    select.addEventListener("change", async (event) => {
        const nextDeviceId = event.target.value;
        if (!nextDeviceId || nextDeviceId === activeDeviceId) return;

        try {
            await startCamera(nextDeviceId);
        } catch (error) {
            status.textContent = `Kamerawechsel fehlgeschlagen: ${error.message}`;
        }
    });

    navigator.mediaDevices.addEventListener("devicechange", async () => {
        const selectedAfterRefresh = await populateSelect({ preferredDeviceId: activeDeviceId });
        if (!selectedAfterRefresh) return;
        if (selectedAfterRefresh !== activeDeviceId) {
            await startCamera(selectedAfterRefresh);
        }
    });

    requestAnimationFrame(renderLoop);
}
