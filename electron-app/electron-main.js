const { app, BrowserWindow } = require('electron')

// loads web page into a new BrowserWindow instance
const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            sandbox: false   // important for camera
        },
        transparent: true,
        frame: false,
        fullscreen: true
    })

    win.loadFile('../index.html')
    win.webContents.openDevTools();
}

/**
 * is called when electron app is started
 * -> opens window
 * -> starts websocket server
 */
app.whenReady().then(() => {
    createWindow()
})