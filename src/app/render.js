(function($){

    $.fn.player = function() {
        
        const { remote, ipcRenderer } = require('electron');
        const context = remote.getGlobal('context');
        
        if (!context||!context.cast) {
            throw new Error('App context not loaded. Unable to create player.')
        }

        const native = this.get(0);
        const id = this.attr('id') || '';
        if (id === '') {
            this.attr('id', id = 'player-' + Math.round(Math.random()*0xffffff))
        }

        const playerOpts = {
            onCanPlay: function() {
                const dim = {
                    width: Math.round($(native).innerWidth()),
                    height: Math.round($(native).innerHeight())
                };
            
                ipcRenderer.send('resize', dim.width, dim.height);
            },
            title: 'CastPlayer - ' + context.title,
            loop: true,
            autoPlay: true,
            fontSize: 'normal'
        };

        asciinema.player.js.CreatePlayer(id, 'data:application/json,' + encodeURI(context.cast), playerOpts);        
        document.title = playerOpts.title;    
    }

    $(document).ready(function(){$('#player').player()})

})(jQuery);
