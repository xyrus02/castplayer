var electronInstaller = require('electron-winstaller');

var settings = {
    appDirectory: './target/win/castplayer-win32-x64',
    outputDirectory: './target/win/castplayer-win32-x64-setup',
    authors: 'Georg Kiehne',
    exe: 'castplayer.exe'
};

resultPromise = electronInstaller.createWindowsInstaller(settings);
 
resultPromise.then(() => {
    console.log("Installer built successfully.");
}, (e) => {
    console.log(`Error building installer: ${e.message}`)
});