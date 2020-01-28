const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const fs = require("fs");

class AsciinemaApp {

    constructor() {
        this.application = null;
        this.window = null;
        this.context = null;
    }

    run(electronApplication, context) {

        if (this.application) {
            throw 'App is already running!';
        }

        const self = this;

        this.application = electronApplication;
        this.context = context;

        this.application.on('window-all-closed', () => {
            if (process.platform !== 'darwin') { // conform to MacOS guidelines
                app.quit();
            }
        });

        this.application.on('ready', () => {
            self.initialize(self.context);

            if (!self.context.cast) {
                self.application.quit(self.context.code);
            }

            self.createWindow();
        });

        this.application.on('activate', () => {
            if (!self.window) { // conform to MacOS guidelines 
                self.createWindow();
            }
        })
    }

    initialize(context) {
        const argv = process.argv;

        context.title = null;
        context.cast = null;
        context.arguments = argv;
        context.code = 0;

        var path;

        try {
            // require 2 args when starting from source, otherwise only 1
            const nReq = (argv||[''])[0] === 'electron' ? 2 : 1;

            if (argv && argv.length && argv.length > nReq) {
                path = argv[argv.length - 1];
            }
            else {
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
            context.cast = fs.readFileSync(path);
        }
        catch(e) {
            dialog.showErrorBox("Error", (e||{}).message || e || "Unknown error.");
            context.code = 1;
        }

        return context;
    }

    createWindow() {

        if (this.window) {
            throw 'Window is already created!';
        }

        this.window = new BrowserWindow({
            title: this.context.title || "Player",
            icon: 'src/resources/ico/application-console-media-play.ico',
            resizable: false,
            'use-content-size': true,
            webPreferences: {
                nodeIntegration: true
            }
        });

        const self = this;

        this.window.setMenuBarVisibility(false);
        this.window.loadFile('src/app/index.html');
        
        this.window.on('closed', () => {
            self.window = null;
        });

        ipcMain.on('resize', function (e, x, y) {
            self.window.setContentSize(x, y);
        });

        return this.window;
    }

    static getContextFromArguments(argv) {

        
    }
};

new AsciinemaApp().run(app, global.context = {});






  
