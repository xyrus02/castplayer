const { app, BrowserWindow } = require('electron')
const fs = require("fs");
const temp = require("temp");

class AsciinemaApp {

    constructor() {
        this.application = null;
        this.windows = [];
    }

    run(electronApplication) {

        if (this.application !== null) {
            throw 'App is already running!';
        }

        this.application = electronApplication;

        this.application.on('window-all-closed', () => {
            if (process.platform !== 'darwin') { // conform to MacOS guidelines
                app.quit();
            }
        });

        this.application.on('ready', () => {
            this.windows.push(this.createWindow());
        });

        this.application.on('activate', () => {
            if (this.windows.length <= 0) { // conform to MacOS guidelines 
                this.windows.push(this.createWindow());
            }
        })
    }

    createWindow() {
        let window = new BrowserWindow({
            width: 1024,
            height: 720,
            webPreferences: {
                nodeIntegration: true
            }
        });
    
        window.loadFile('app/index.html');
        window.on('closed', () => {
            window = null;
        });

        return window;
    }

    static getCastFromArguments(argv) {
        if (!argv || !argv.length || argv.length < 2) {
            return null;
        }

        const path = argv[argv.length - 1];
        const tmpf = temp.openSync('asciinema');

        fs.copyFileSync(path, tmpf.path);

        try {
            return 'file:///' + (tmpf.path.replace(/^\/(.+)$/g, '$1').replace(/\\/g, '/'));
        }
        catch(e) {
            console.error(e);
            return null;
        }
    }
};

temp.track();
global.context = { 
    arguments: process.argv,
    cast: AsciinemaApp.getCastFromArguments(process.argv)
};

new AsciinemaApp().run(app);






  
