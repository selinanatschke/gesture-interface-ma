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
        frame: true,
    })

    win.loadFile('../index.html')
}

app.whenReady().then(() => {
    createWindow()
})