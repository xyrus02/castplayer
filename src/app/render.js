const { remote, ipcRenderer } = require('electron');
const context = remote.getGlobal('context');

if (context && context.cast) {
    
    const playerElement = document.getElementById('player');
    
    asciinema.player.js.CreatePlayer('player', 'data:application/json,' + encodeURI(context.cast), {
        onCanPlay: function() {
            const dim = {
                width: playerElement.clientWidth,
                height: playerElement.clientHeight
            };
        
            ipcRenderer.send('resize', dim.width, dim.height);
        },
        title: 'CastPlayer - ' + context.title,
        loop: true,
        autoPlay: true,
        fontSize: 'normal'
    });

    document.title = 'CastPlayer - ' + context.title;
}
