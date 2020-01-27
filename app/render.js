if (require) {
    const { remote } = require('electron');
    const context = remote.getGlobal('context');

    if (context && context.cast) {
        asciinema.player.js.CreatePlayer('player', 'data:application/json,' + encodeURI(context.cast));
    }
}

