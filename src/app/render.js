
(function($){

    $.fn.setState = function(state) {
        ( state ? this.addClass : this.removeClass).call(this, 'fstate-disabled');
        (!state ? this.addClass : this.removeClass).call(this, 'fstate-enabled');
    }

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

            this.owner = query.get(0);
            this.element = $client.get(0);
            this.context = context;

            $(this.owner).prepend($client)
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
                autoPlay: true,
                fontSize: 'normal',
                theme: 'asciinema'
            };

            this.isPlaying = true;
            this.isLooping = false;

            try {
                const uri = 'data:application/json,' + encodeURIComponent(this.context.cast);
                this.player = asciinema.player.js.CreatePlayer(this.elementId, uri, playerOpts);        
            }
            catch (e) {
                console.error(e);
                return false;
            }

            const self = this;

            document.title = playerOpts.title; 
            $('body').css({'background-color': $('pre.asciinema-terminal').css('background-color')||'black'});

            setTimeout(() => $(self.element).show(), 500);
            setTimeout(() => self.updateLoop(), 100);
            
            return this;
        }

        bind(ctl) {
            this.controls = ctl;
            const self = this;

            const togglePlay = function() {
                if (self.isPlaying) self.pause();
                else self.play();
            };

            const showBar = function() {
                if ($(self.controls.bar).data('sto')) {
                    clearTimeout($(self.controls.bar).data('sto'));
                }
                $(self.controls.bar).stop().animate({opacity: 1}, 250);

                if (!$(self.controls.bar).is(':hover')) {
                    $(self.controls.bar).data('sto', setTimeout(() => $(self.controls.bar).stop().animate({opacity: 0}, 250), 1000));
                }
            };

            $(window).on('keyup', (e) => {
                if (e.code === "Space") {
                    togglePlay();
                }

                showBar();
            });

            $('body').on('mousemove', showBar);

            this.controls.play.on('click', togglePlay);

            this.controls.loop.on('click', () => {
                const isLooping = self.isLooping;
                self.setIsLooping.call(self, !isLooping);
            });

            this.controls.seek.on('input', () => {

                if (self.controls.seek.attr('data-updating') === 'true') {
                    return;
                }

                self.controls.seek.attr('data-updating', 'true');
                self.seek.call(self, self.controls.seek.val());
                self.controls.seek.attr('data-updating', 'false');
            });

            this.controls.seek.on('change', () => {

                if (self.isPlaying) {
                    self.player.play();
                }
            });

            this.setIsLooping(this.isLooping);
            this.updatePosition();

            $(this.controls.bar).css({opacity: 1}).data('sto', setTimeout(() => $(self.controls.bar).stop().animate({opacity: 0}, 250), 1000));

            return this;
        }

        play() {
            if (!this.player) {
                return this;
            }

            this.player.play();
            this.isPlaying = true;
            if (this.controls && this.controls.play) {
                $(this.controls.play).setState(true);
            }

            return this;
        }

        pause() {
            if (!this.player) {
                return this;
            }

            this.player.pause();
            this.isPlaying = false;
            if (this.controls && this.controls.play) {
                $(this.controls.play).setState(false);
            }

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

            this.player.pause();
            this.player.setCurrentTime(time);

            if (this.player.isPlaying) {
                this.player.play();
            }

            return this;
        }

        setIsLooping(val) {
            this.isLooping = val;

            if (this.controls && this.controls.loop) {
                $(this.controls.loop).setState(this.isLooping);
            }

            return this;
        }

        updateLoop() {
            if (!this.player) {
                return;
            }

            const self = this;
            const time = this.player.getCurrentTime();
            const duration = this.player.getDuration();

            if (this.isPlaying && (time >= duration) && (duration > 0)) {
                this.player.pause();

                if (this.isLooping) {
                    this.player.setCurrentTime(0);
                    this.player.play();
                } else {
                    $(self.controls.play).addClass('pause');
                    $(self.controls.play).removeClass('play');
                    this.isPlaying = false;
                }
            }

            setTimeout(() => self.updateLoop.call(self), 100);
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

            if (this.isPlaying) {
                this.controls.seek.attr('data-updating', 'true');
                this.controls.seek.val(100 * time / duration);
                this.controls.seek.attr('data-updating', 'false');
            }
            
            this.controls.seekBar.css({'width': (100*time/duration) + '%'});
            this.controls.position.text(
                tmin.toString().padStart(2, '0') + ':' + tsec.toString().padStart(2, '0') + ' / ' +
                dmin.toString().padStart(2, '0') + ':' + dsec.toString().padStart(2, '0'));

            setTimeout(() => self.updatePosition.call(self), 100);

            return this;
        }

        export() {
            if (!this.player) {
                return;
            }

            html2canvas(this.element).then(function(canvas) {
                console.log(canvas);
            });
        }
    }

    $.fn.player = function() { 
        
        const $playButton = $('<button/>').addClass('play').addClass('fstate-disabled')
            .append($('<i/>').addClass('fas').addClass('fstate-enable').addClass('fa-play'))
            .append($('<i/>').addClass('fas').addClass('fstate-disable').addClass('fa-pause'))
            .append($('<span/>').addClass('tip').addClass('fstate-enable').text('Play cast'))
            .append($('<span/>').addClass('tip').addClass('fstate-disable').text('Pause cast'));

        const $loopButton = $('<button/>').addClass('loop').addClass('fstate-disabled')
            .append($('<i/>').addClass('fas').addClass('fstate-enable').addClass('fa-sync-alt'))
            .append($('<i/>').addClass('fas').addClass('fstate-disable').addClass('fa-redo-alt'))
            .append($('<span/>').addClass('tip').addClass('fstate-enable').text('Enable automatic repeat'))
            .append($('<span/>').addClass('tip').addClass('fstate-disable').text('Disable automatic repeat'));

        const $seekBar = $('<div/>').addClass('seek-bg')
            .css({'width': '0%'});

        const $seekSlider = $('<input/>').addClass('seek')
            .attr('type', 'range')
            .attr('min', 0)
            .attr('max', 100)
            .attr('step', 0.1)
            .val(0);

        const $seekPosition = $('<div/>').addClass('seek-position')
            .text('00:00 / 00:00');

        const $controls = $('<div/>').addClass('controls')
            .append($playButton)
            .append($loopButton)
            .append($('<div/>').addClass('seek-wrapper').append($seekBar, $seekSlider))
            .append($seekPosition);

        this.append($controls);

        if (typeof require !== "undefined") {
            this.api = new AsciinemaPlayer(this, require('electron').remote.getGlobal('context')).initialize();
            if (!this.api) {
                $(this.api.element).hide();
            }

            this.api.bind({
                    frame: this,
                    bar: $controls,
                    play: $playButton,
                    loop: $loopButton,
                    seek: $seekSlider,
                    seekBar: $seekBar,
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
