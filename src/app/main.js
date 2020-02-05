const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const fs = require("fs");

class CastPlayerApp {

    attachEvents() {

        const $this = this;

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') { // conform to MacOS guidelines
                app.quit();
            }
        });
        app.on('activate', () => {
            if (!$this.window) { // conform to MacOS guidelines 
                $this.createWindow($this.context);
            }
        });
        app.on('ready', () => {
            const {code, context} = $this.createContext();

            if (!context || !context.cast) {
                app.quit(code||-1);
            }

            $this.context = global.context = context;
            $this.createWindow(context);
        })

        ipcMain.on('player-ready', function (_, data) {
            $this.window.setContentSize(data.size.width, data.size.height);

            const outerSize = $this.window.getSize();
            $this.window.setMinimumSize(outerSize[0], outerSize[1]);
        });
        ipcMain.on("player-error", (_, error) => {
            dialog.showErrorBox("Error", `Unable to load cast: ${error}`);
            app.exit(1);
        });
        ipcMain.on("gif-exporting", (e, buffer) => {

            const result = dialog.showSaveDialogSync({ 
                properties: ['openFile'], 
                title: 'Save cast as GIF...',
                filters: [
                    { name: 'Graphics interchange format (*.gif)', extensions: ['gif'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (!result) {
                e.sender.send("gif-exported", null);
                return;
            }

            fs.writeFileSync(result, buffer);
            e.sender.send("gif-exported", result);
        });

        return this;
    }

    createContext() {
        const argv = process.argv;

        if (app.isPackaged) {
            argv.unshift(null)
        }

        let code = 0;
        let path = null;
        let context = {
            title: null,
            cast: null
        }

        try {
            if (argv && argv.length > 2) {
                path = argv[argv.length - 1];
            }

            if (path === null) {
                const result = dialog.showOpenDialogSync({ 
                    properties: ['openFile'], 
                    title: 'Open cast...',
                    filters: [
                        { name: 'Casts (*.json, *.cast, *.txt)', extensions: ['json', 'cast', 'txt'] },
                        { name: 'All Files', extensions: ['*'] }
                    ]
                });
    
                if (!result || !result.length) {
                    return;
                }
    
                path = result[0];
            }

            context.title = path;
            context.cast = fs.readFileSync(path, "utf8").trim();
        }
        catch(e) {
            dialog.showErrorBox("Error", (e||{}).message || e || "Unknown error.");
            code = 1;
        }

        return {code, context};
    }

    createWindow(context) {

        if (this.window) {
            throw new Error('Window is already created!');
        }

        this.window = new BrowserWindow({
            title: context.title || "Player",
            icon: 'src/resources/app.' + (process.platform == 'darwin' ? 'icns' : 'ico'),
            'use-content-size': true,
            minWidth: 640,
            minHeight: 480,
            webPreferences: {
                nodeIntegration: true
            }
        });

        const $this = this;

        this.window.setMenuBarVisibility(false);
        this.window.loadFile('src/app/index.html');
        
        this.window.on('closed', () => {
            $this.window = null;
        });
    }
};

let _ = new CastPlayerApp().attachEvents();






  
