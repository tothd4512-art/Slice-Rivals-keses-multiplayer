// Electron Desktop (.exe) belépési pont a BLADE RIVALS játékhoz
// Használat PC-n: npm install -D electron electron-builder && npm run build:exe
const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'BLADE RIVALS — 3D Csak Kés Aréna',
    backgroundColor: '#070b14',
    autoHideMenuBar: true,
    fullscreenable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
}

// The desktop app hosts rooms on this PC: the same game server as the standalone one.
// Friends on the same network can join with the room code (http://<this-PC-IP>:8787).
async function startLocalServer() {
  try {
    const { startGameServer } = await import('./server/core.js');
    await startGameServer({
      port: 8787,
      host: '0.0.0.0',
      distDir: path.join(__dirname, 'dist'),
      log: (msg) => console.log(msg)
    });
  } catch (err) {
    // Port already taken (for example another server is running): the game still works, just without hosting.
    console.warn('Helyi szerver nem indult el:', err.message);
  }
}

app.whenReady().then(() => {
  startLocalServer();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});
