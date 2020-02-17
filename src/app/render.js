/***********************************************************************************************************************************************/
/** common.js **/
/***********************************************************************************************************************************************/

(function($){ // State manager

    $('head').append($('<style type="text/css" />').text(
        '.fstate-disabled>.fstate-enable{display:none!important;}' +
        '.fstate-enabled>.fstate-disable{display:none!important;}'
    ));

    $.fn.setState = function(state) {
        ( state ? this.addClass : this.removeClass).call(this, 'fstate-disabled');
        (!state ? this.addClass : this.removeClass).call(this, 'fstate-enabled');
    };

})(jQuery);

/***********************************************************************************************************************************************/
/** cast-player.js **/
/***********************************************************************************************************************************************/

const { remote, ipcRenderer } = require('electron');

class Cast {
    constructor(rawData, title) {
        try {
            this.valid = (rawData && rawData !== '');
            this.error = undefined;
            this.title = title || 'untitled cast';
            this.encodedData = !this.valid ? null : 'data:application/json,' + encodeURIComponent(rawData);
            this.header = !this.valid ? {} : JSON.parse(rawData.split(/\r?\n/g)[0]);
            this.frames = !this.valid ? [] : rawData.split(/\r?\n/g).filter((_,i)=>i>0).map(x => [].concat(JSON.parse(x)||[])).map(x => ({
                timestamp: x[0],
                direction: x[1],
                data: x[2]
            }));
        }
        catch(e) {
            this.valid = false;
            this.error = (e||{}).message || e || 'Unknown error';
            this.title = null;
            this.encodedData = null;
            this.header = {};
            this.frames = [];
        }

    }
}

class CastPlayerComponentFactory {
    constructor($) {
        this.$ = $;
    }

    createComponent(name, config) {
        const selector = this.$(`<${name||'div'}/>`);
        (config || (()=>{}))(selector, this.$);
        return {
            $selector: selector
        };
    }

    createOverlay() {
        const overlay = this.createComponent('div', ($q, $) => $q
            .addClass('overlay')
            .append($('<div/>').addClass('lds-ripple')
                .append($('<div/>'))
                .append($('<div/>'))));

        const status = this.createComponent('span', $q => $q.addClass('status').text('please wait'));

        overlay.status = status;
        overlay.$selector.append(status.$selector);

        overlay.read = function() {
            return status.$selector.text();
        }
        overlay.update = function(text) {
            status.$selector.text(text || status.read());
            return status;
        }
        overlay.show = function(text) {
            overlay.$selector.show();
            overlay.update(text || 'please wait');
            return status;
        }
        overlay.hide = function() {
            overlay.$selector.hide();
            return status;
        }

        return overlay;
    }

    createPlayerClient(owner) {

        if (!owner) {
            throw new Error('CastPlayer owner expected');
        }

        const pid = 'pc-' + Math.round(Math.random()*0xffffff);
        const player = this.createComponent('div', $q => $q.addClass('player-client').attr('id', pid));
        const $this = this;
        
        player.pid = pid;
        player.createInstance = function() {

            const cast = owner.cast;

            if (!cast || !cast.valid) {
                ipcRenderer.send('player-error', (cast||{}).error||'Unknown error');
                return;
            }

            const asciinemaPlayer = asciinema.player.js.CreatePlayer(pid, cast.encodedData, {
                onCanPlay: function() {
                    const dim = player.size = {
                        width: Math.round(player.$selector.innerWidth()),
                        height: Math.round(player.$selector.innerHeight() + 50 /* pixels for toolbar */)
                    };
                
                    $this.$('body, div.overlay').css({'background-color': $('pre.asciinema-terminal').css('background-color')||'black'});
                    ipcRenderer.send('player-ready', { id: pid, size: dim });
                    setTimeout(() => owner.overlay.hide.call(owner.overlay), 500);
                },
                autoPlay: true,
                fontSize: 'normal',
                theme: 'asciinema'
            });

            player.intf = asciinemaPlayer;

            delete(player.createInstance);
            return player;
        }

        return player;
    }

    createControlBar(owner) {

        const playButton = this.createComponent('button', ($q,$) => $q.addClass('play').addClass('fstate-disabled')
            .append($('<i/>').addClass('fas').addClass('fstate-enable').addClass('fa-play'))
            .append($('<i/>').addClass('fas').addClass('fstate-disable').addClass('fa-pause'))
            .append($('<span/>').addClass('tip').addClass('fstate-enable').text('Play cast'))
            .append($('<span/>').addClass('tip').addClass('fstate-disable').text('Pause cast'))
            .on('click', () => playButton.$selector.setState(owner.togglePlayPause.call(owner))));

        const loopButton = this.createComponent('button', ($q,$) => $q.addClass('loop').addClass('fstate-disabled')
            .append($('<i/>').addClass('fas').addClass('fstate-enable').addClass('fa-sync-alt'))
            .append($('<i/>').addClass('fas').addClass('fstate-disable').addClass('fa-redo-alt'))
            .append($('<span/>').addClass('tip').addClass('fstate-enable').text('Enable automatic repeat'))
            .append($('<span/>').addClass('tip').addClass('fstate-disable').text('Disable automatic repeat'))
            .on('click', () => loopButton.$selector.setState(owner.toggleIsLooping.call(owner))));

        const exportButton = this.createComponent('button', ($q,$) => $q.addClass('export')
            .append($('<i/>').addClass('fas').addClass('fa-video'))
            .append($('<span/>').addClass('tip').addClass('right').text('Save as GIF'))
            .on('click', () => owner.saveAsGif.call(owner)));

        const seekBar = this.createComponent('div', $q => $q.addClass('seek-bg').css({'width': '0%'}));
        const seekPosition = this.createComponent('div', $q => $q.addClass('seek-position').text('00:00 / 00:00'));
        const seekSlider = this.createComponent('input', $q => $q.addClass('seek').attr('type', 'range').attr('min', 0).attr('max', 100).attr('step', 0.1).val(0)
            .on('input', () => {

                if (seekSlider.$selector.attr('data-updating') === 'true') {
                    return;
                }

                seekSlider.$selector.attr('data-updating', 'true');
                owner.seekPosition.call(owner, seekSlider.$selector.val());
                seekSlider.$selector.attr('data-updating', 'false');
            })
            .on('change', () => owner.ensurePlayingState.call(owner)));

        const bar = this.createComponent('div', ($q,$) => $q.addClass('controls')
            .append(playButton.$selector)
            .append(loopButton.$selector)
            .append($('<div/>').addClass('seek-wrapper').append(seekBar.$selector, seekSlider.$selector))
            .append(seekPosition.$selector)
            .append(exportButton.$selector)
            .css({opacity: 1}));

        bar.hideTimeout = 1000;

        bar.show = function() {
            if (bar.$selector.data('hide-timeout-handle')) {
                clearTimeout(bar.$selector.data('hide-timeout-handle'));
            }

            bar.$selector.stop().animate({opacity: 1}, 250);

            if (!bar.$selector.is(':hover')) {
                bar.$selector.data('hide-timeout-handle', setTimeout(() => bar.hide.call(bar, true), bar.hideTimeout));
            }
        }

        bar.hide = function(skipClearTimeout) {
            if (!skipClearTimeout && bar.$selector.data('hide-timeout-handle')) {
                clearTimeout(bar.$selector.data('hide-timeout-handle'));
            }

            bar.$selector.stop().animate({opacity: 0}, 250);
        }

        bar.updatePosition = function() {
            if (owner.isExporting) {
                setTimeout(() => bar.updatePosition.call(seekSlider), 100);
                return;
            }
    
            if (seekSlider.$selector.attr('data-updating') === 'true') {
                return;
            }
    
            const time = owner.player.intf.getCurrentTime();
            const duration = owner.player.intf.getDuration();

            const tmin = Math.floor(time / 60.0);
            const tsec = Math.round(time - 60 * tmin);

            const dmin = Math.floor(duration / 60.0);
            const dsec = Math.round(duration - 60 * dmin);
    
            if (owner.isPlaying) {
                seekSlider.$selector.attr('data-updating', 'true');
                seekSlider.$selector.val(100 * time / duration);
                seekSlider.$selector.attr('data-updating', 'false');
            }
                
            seekBar.$selector.css({'width': (100*time/duration) + '%'});
            seekPosition.$selector.text(
                tmin.toString().padStart(2, '0') + ':' + tsec.toString().padStart(2, '0') + ' / ' +
                dmin.toString().padStart(2, '0') + ':' + dsec.toString().padStart(2, '0'));
    
            setTimeout(() => bar.updatePosition.call(seekSlider), 100);
        }

        this.$('body').on('mousemove', () => bar.show.call(bar));
        this.$(window).on('keyup', e => {
            if (e.code === "Space") {
                owner.togglePlayPause.call(owner);
            }

            bar.show.call(bar);
        });

        bar.syncButtonStates = function() {
            playButton.$selector.setState(owner.isPlaying);
            loopButton.$selector.setState(owner.isLooping);
        }

        return bar;
    }
}

class CastPlayer {
    constructor($query) {
        const context = remote.getGlobal('context') || {};
        const factory = new CastPlayerComponentFactory(jQuery);

        this.$selector = $query || jQuery();
        this.$selector.append((this.player = factory.createPlayerClient(this)).$selector);
        this.$selector.append((this.controls = factory.createControlBar(this)).$selector);
        this.$selector.append((this.overlay = factory.createOverlay(this)).$selector);

        this.cast = new Cast(context.cast, context.title);

        this.isPlaying = this.cast.valid;
        this.isLooping = this.cast.valid;
        this.isExporting = false;

        this.player.createInstance();
        this.ensureLoopKeepsPlaying();

        this.controls.syncButtonStates();
        this.controls.updatePosition();
        this.controls.show();

        console.log(this);

        document.title = this.cast.valid ? `CastPlayer - ${this.cast.title}` : 'CastPlayer'; 

        const $this = this;
        ipcRenderer.on('gif-exported', () => $this.finalizeExport());
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.player.intf.pause();
            this.isPlaying = false;
        }
        else {
            this.player.intf.play();
            this.isPlaying = true;
        }

        return this.isPlaying;
    }

    toggleIsLooping() {
        return this.isLooping = !this.isLooping;
    }
    
    seekPosition(value) {

        console.log(value);

        const d = this.player.intf.getDuration();
        const time = (value||0) / 100.0 * d;

        this.player.intf.pause();
        this.player.intf.setCurrentTime(time);
        this.ensurePlayingState();

        return this;
    }

    ensurePlayingState() {
        if (this.isPlaying) {
            this.player.intf.play();
        }
    }

    ensureLoopKeepsPlaying() {

        const $this = this; 

        if (this.isExporting) {
            setTimeout(() => $this.ensureLoopKeepsPlaying.call($this), 100);
            return;
        }

        const time = this.player.intf.getCurrentTime();
        const duration = this.player.intf.getDuration();

        if (this.isPlaying && (time >= duration) && (duration > 0)) {
            this.player.intf.pause();

            if (this.isLooping) {
                this.player.intf.setCurrentTime(0);
                this.player.intf.play();
            } else {
                this.isPlaying = false;
                this.controls.syncButtonStates();
            }
        }

        setTimeout(() => $this.ensureLoopKeepsPlaying.call($this), 100);
    }

    async saveAsGif() {
        this.isExporting = true;
        this.player.intf.pause();
        this.overlay.show('exporting gif');

        const originalPos = this.player.intf.getCurrentTime();
        const frames = this.cast.frames.length;
        let nextTime = 0, time = 0.0;

        const dpr = window.devicePixelRatio;
        const gif = new GIF({
            workers: 2,
            workerScript: '../lib/gifjs/gif.worker.js',
            quality: 30,
            width: this.player.size.width * dpr,
            height: (this.player.size.height - 50) * dpr /* pixels for controlbar */
        });

        const playerNativeElement = this.player.$selector.get(0);

        for (let i = 0; i < this.cast.frames.length; i++) {
            time = this.cast.frames[i].timestamp;
            nextTime = i < this.cast.frames.length - 1 ? this.cast.frames[i + 1].timestamp : time + 2;
            this.player.intf.setCurrentTime(time);
            gif.addFrame(await html2canvas(playerNativeElement),{delay: Math.round((nextTime - time) * 1000)});
            this.overlay.update(`rendering frame ${i + 1} of ${frames}`);
        }
        
        this.overlay.update(`creating output stream`)
        this.player.intf.setCurrentTime(originalPos);

        const $this = this;

        gif.on('progress', function(v) {
            $this.overlay.update(`compressing frame ${1 + Math.round(v * (frames - 1))} of ${frames}`);
        });
        gif.on('finished', function(blob) {

            $this.overlay.update(`saving output stream`);

            const reader = new FileReader();
            reader.onload = function() {
                if (reader.readyState == 2) {
                    ipcRenderer.send("gif-exporting", new Buffer(reader.result));
                }
            };
            reader.readAsArrayBuffer(blob);
        });
          
        gif.render();
    }

    finalizeExport() {
        this.overlay.update('please wait');
        this.overlay.hide();
        this.isExporting = false;
        this.ensurePlayingState();
    }
}

jQuery(document).ready(function(){window.player = new CastPlayer(jQuery('#player'))})