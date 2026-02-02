import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { activityTracker } from './activity-tracker'
import { initTray } from './tray'
import { syncService } from './sync-service'
import { screenshotService } from './screenshot-service'
import { writeFileSync } from 'fs'
import { join as joinPath } from 'path'
const { autoUpdater } = require('electron-updater')


// Crash logging
const crashLogPath = joinPath(app.getPath('userData'), 'crash.log');
const logError = (error: any) => {
    const message = `[${new Date().toISOString()}] ${error.stack || error}\n`;
    console.error(message);
    try {
        writeFileSync(crashLogPath, message, { flag: 'a' });
    } catch (e) {
        console.error('Failed to write to crash log:', e);
    }
};

process.on('uncaughtException', (err) => {
    logError(err);
});

process.on('unhandledRejection', (reason) => {
    logError(reason);
});

let mainWindow: BrowserWindow | null = null;
let screenshotPopup: BrowserWindow | null = null;
let currentUserId: string | null = null;
let currentAccessToken: string | null = null;

function createScreenshotPopup(data: any): void {
    if (screenshotPopup && !screenshotPopup.isDestroyed()) {
        screenshotPopup.close();
    }

    const preloadPath = join(__dirname, '../preload/index.mjs');

    screenshotPopup = new BrowserWindow({
        width: 420,
        height: 560,
        frame: false,
        alwaysOnTop: true,
        show: false,
        backgroundColor: '#0f172a', // Slate-900
        webPreferences: {
            preload: preloadPath,
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    const popupUrl = is.dev && process.env['ELECTRON_RENDERER_URL']
        ? `${process.env['ELECTRON_RENDERER_URL']}#screenshot-popup`
        : `${join(__dirname, '../renderer/index.html')}#screenshot-popup`;

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        screenshotPopup.loadURL(popupUrl);
    } else {
        screenshotPopup.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'screenshot-popup' });
    }

    screenshotPopup.once('ready-to-show', () => {
        if (screenshotPopup) {
            screenshotPopup.show();
            screenshotPopup.webContents.send('screenshot-data', data);
        }
    });

    screenshotPopup.on('closed', () => {
        screenshotPopup = null;
    });
}

function createWindow(): void {
    const preloadPath = join(__dirname, '../preload/index.mjs')
    console.log('Main Process: Looking for preload at', preloadPath);

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 900,
        height: 670,
        show: false,
        autoHideMenuBar: true,
        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
            preload: preloadPath,
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show()
        if (mainWindow) initTray(mainWindow)
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // Screenshot Trigger Listener
    const onTriggerScreenshot = async (metadata: any) => {
        console.log('Main: Screenshot triggered');
        try {
            const image = await screenshotService.captureScreen();
            const aiDescription = await screenshotService.generateAIDescription(image);

            createScreenshotPopup({
                image,
                aiDescription,
                metadata: {
                    ...metadata,
                    userId: metadata.userId || currentUserId,
                    token: metadata.token || currentAccessToken
                }
            });
        } catch (e) {
            console.error('Capture failed', e);
        }
    };
    activityTracker.on('trigger-screenshot', onTriggerScreenshot);

    // Clean up listener when window closes
    mainWindow.on('closed', () => {
        activityTracker.off('trigger-screenshot', onTriggerScreenshot);
        if (screenshotPopup && !screenshotPopup.isDestroyed()) {
            screenshotPopup.close();
        }
    });

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // Prevent closing, hide instead
    mainWindow.on('close', (event) => {
        if (!(app as any).isQuitting) {
            event.preventDefault()
            mainWindow?.hide()
        }
        return false
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.sentineltrack')

    // Configure Auto-Updater
    if (!is.dev) {
        // Only check for updates in production
        autoUpdater.logger = console
        autoUpdater.checkForUpdatesAndNotify()

        // Check for updates every 4 hours
        setInterval(() => {
            autoUpdater.checkForUpdatesAndNotify()
        }, 4 * 60 * 60 * 1000)

        // Auto-updater event handlers
        autoUpdater.on('update-available', () => {
            console.log('Update available')
        })

        autoUpdater.on('update-downloaded', () => {
            console.log('Update downloaded')
            // Optionally notify the user through the renderer
            if (mainWindow) {
                mainWindow.webContents.send('update-ready')
            }
        })

        autoUpdater.on('error', (err: Error) => {
            console.error('Auto-updater error:', err)
        })
    }

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    // IPC Handlers
    console.log('Registering IPC handlers...');

    ipcMain.handle('start-tracking', (_, metadata) => {
        console.log('IPC: start-tracking', metadata);
        activityTracker.startTracking(metadata);
        return true;
    });

    ipcMain.handle('stop-tracking', async () => {
        console.log('IPC: stop-tracking');
        await activityTracker.stopTracking();
        // Force immediate sync to Supabase so history updates right away
        await syncService.syncPendingLogs();
        return true;
    });

    ipcMain.handle('pause-tracking', () => {
        console.log('IPC: pause-tracking');
        activityTracker.pauseTracking();
        return true;
    });

    ipcMain.handle('resume-tracking', () => {
        console.log('IPC: resume-tracking');
        activityTracker.resumeTracking();
        return true;
    });

    ipcMain.handle('reset-tracking', () => {
        console.log('IPC: reset-tracking');
        activityTracker.resetTracking();
        return true;
    });

    ipcMain.handle('get-activity-stats', () => {
        return activityTracker.getStats();
    });

    ipcMain.handle('get-history', async (_, userId: string) => {
        console.log('IPC: get-history for', userId);
        return await syncService.getHistory(userId);
    });

    ipcMain.handle('save-manual-log', async (_, logData) => {
        console.log('IPC: save-manual-log', logData);
        return await syncService.addManualLog(logData);
    });

    ipcMain.handle('set-user-id', (_, userId: string) => {
        try {
            console.log('IPC: set-user-id', userId);
            currentUserId = userId;
            activityTracker.setUserId(userId);
            return true;
        } catch (error) {
            console.error('IPC: set-user-id error:', error);
            throw error;
        }
    });

    ipcMain.handle('set-supabase-session', async (_, accessToken: string) => {
        try {
            console.log('IPC: set-supabase-session');
            currentAccessToken = accessToken;
            await syncService.setSession(accessToken);
            return true;
        } catch (error) {
            console.error('IPC: set-supabase-session error:', error);
            return false; // Return false instead of throwing to prevent channel closure
        }
    });

    ipcMain.handle('save-screenshot', async (_, { userId, dataUrl, description, metadata, token }) => {
        console.log('IPC: save-screenshot for', userId);
        const success = await screenshotService.uploadScreenshot(
            userId,
            dataUrl,
            description,
            metadata.projectId,
            metadata.milestoneId,
            metadata.taskId,
            token,
            metadata.sessionId
        );

        if (success && screenshotPopup && !screenshotPopup.isDestroyed()) {
            screenshotPopup.close();
        }

        return success;
    });

    ipcMain.handle('close-screenshot-popup', () => {
        if (screenshotPopup && !screenshotPopup.isDestroyed()) {
            screenshotPopup.close();
        }
    });

    createWindow()

    app.on('render-process-gone', (event, webContents, details) => {
        console.error('Renderer process gone:', details.reason, details.exitCode);
    });

    app.on('child-process-gone', (event, details) => {
        console.error('Child process gone:', details.type, details.reason, details.exitCode);
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
