const { remote } = require('electron');

const context = remote.getGlobal('context');
const player = document.getElementById('player');

if (context && context.cast) {
    player.setAttribute('src', context.cast);
    console.log(player.getAttribute('src'));

    // will crash because the file in SRC is actually not accessible...
    // player.play();
}