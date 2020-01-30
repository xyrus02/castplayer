
(function($){

    class AsciinemaPlayer {

        constructor(query, context) {
            
            if (!query) {
                throw new Error('Player element not found.')
            }

            if (!context||!context.cast) {
                throw new Error('App context not loaded. Unable to create player.')
            }

            const $client = $('<div></div>')
                .addClass('player-client')
                .attr('id', this.elementId = 'pc-' + Math.round(Math.random()*0xffffff))
                .hide();

            $(query.get(0)).prepend($client)

            this.element = $client.get(0);
            this.context = context;
        }

        initialize() {

            const element = this.element;
            const { ipcRenderer } = require('electron');
            const playerOpts = {
                onCanPlay: function() {
                    const dim = {
                        width: Math.round($(element).innerWidth()),
                        height: Math.round($(element).innerHeight())
                    };
                
                    ipcRenderer.send('resize', dim.width, dim.height);
                },
                title: 'CastPlayer - ' + this.context.title || 'untitled cast',
                loop: true,
                autoPlay: true,
                fontSize: 'normal'
            };

            this.isPlaying = true;
            this.player = asciinema.player.js.CreatePlayer(this.elementId, 'data:application/json,' + encodeURI(this.context.cast), playerOpts);        

            const self = this;

            document.title = playerOpts.title; 
            setTimeout(() => $(self.element).show(), 500);
            
            return this;
        }

        bind(ctl) {
            this.controls = ctl;
            const self = this;

            this.controls.play.on('click', () => {

                var fun;
                if (self.isPlaying) {
                    $(self.controls.play).addClass('pause');
                    $(self.controls.play).removeClass('play');
                    fun = self.pause;
                }
                else {
                    $(self.controls.play).addClass('play');
                    $(self.controls.play).removeClass('pause');
                    fun = self.play;
                }

                fun.call(self)
            });

            this.controls.seek.on('input', () => {

                if (self.controls.seek.attr('data-updating') === 'true') {
                    return;
                }

                self.controls.seek.attr('data-updating', 'true');
                self.seek.call(self, self.controls.seek.val());
                self.controls.seek.attr('data-updating', 'false');
            });

            this.updatePosition();
            return this;
        }

        play() {
            if (!this.player) {
                return this;
            }

            this.player.play();
            this.isPlaying = true;
            return this;
        }

        pause() {
            if (!this.player) {
                return this;
            }

            this.player.pause();
            this.isPlaying = false;
            return this;
        }

        stop() {
            if (!this.player) {
                return this;
            }

            this.player.pause();
            this.player.setCurrentTime(0);
            this.isPlaying = false;
            return this;
        }

        seek(pos) {
            if (!this.player) {
                return;
            }

            const d = this.player.getDuration();
            const time = pos / 100.0 * d;

            console.log(time);

            this.player.pause();
            this.player.setCurrentTime(time);

            if (this.player.isPlaying) {
                this.player.play();
            }

            return this;
        }

        updatePosition() {
            if (!this.controls || !this.player) {
                return this;
            }

            if (this.controls.seek.attr('data-updating') === 'true') {
                return;
            }

            const time = this.player.getCurrentTime();
            const duration = this.player.getDuration();

            const self = this;

            const tmin = Math.floor(time / 60.0);
            const tsec = Math.round(time - 60 * tmin);

            const dmin = Math.floor(duration / 60.0);
            const dsec = Math.round(duration - 60 * dmin);

            this.controls.seek.attr('data-updating', 'true');
            this.controls.seek.val(100 * time / duration);
            this.controls.seek.attr('data-updating', 'false');

            this.controls.position.text(
                tmin.toString().padStart(2, '0') + ':' + tsec.toString().padStart(2, '0') + ' / ' +
                dmin.toString().padStart(2, '0') + ':' + dsec.toString().padStart(2, '0'));

            setTimeout(() => self.updatePosition.call(self), 100);

            return this;
        }
    }

    $.fn.player = function() { 
        
        const $playButton = $('<button/>').addClass('play')
            .append($('<i/>').addClass('fas').addClass('fa-play'))
            .append($('<i/>').addClass('fas').addClass('fa-pause'));

        const $seekSlider = $('<input/>').addClass('seek')
            .attr('type', 'range')
            .attr('min', 0)
            .attr('max', 100)
            .attr('step', 1)
            .val(0);

        const $seekPosition = $('<div/>').addClass('seek-position')
            .text('00:00 / 00:00');

        const $controls = $('<div/>').addClass('controls')
            .append($playButton)
            .append($seekSlider)
            .append($seekPosition);

        const self = this;

        this.append($controls);
        this.on('mousemove', () => {
            if (self.data('sto')) {
                clearTimeout(self.data('sto'));
            }
            $controls.stop().animate({opacity: 1}, 250);
            self.data('sto', setTimeout(() => $controls.stop().animate({opacity: 0}, 250), 1000));
        })

        if (typeof require !== "undefined") {
            this.api = new AsciinemaPlayer(this, require('electron').remote.getGlobal('context'))
                .initialize()
                .bind({
                    play: $playButton,
                    seek: $seekSlider,
                    position: $seekPosition
                });
        }
        else {
            console.warn("No application context!");
        }
    
        return this;
    }

    $(document).ready(function(){$('#player').player()})

})(jQuery);
