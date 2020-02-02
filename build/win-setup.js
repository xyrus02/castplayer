(function() {

    if (process.platform !== 'win32') {
        console.error('This script can only be run on Windows. Exiting.');
        process.exit(1);
    }

    const { spawn } = require('child_process');
    const fs = require('fs');
    const temp = require('temp').track();

    this.options = (function(argv){
        let args = argv; args.shift(); args.shift();
    
        console.log('Creating windows setup with the following arguments:', args.join(' '));
        let options = {
            in: null,
            use: null,
            out: null,
            tmp: temp.path({suffix:'.wxobj'}),
            suffixVersion: false,
            meta: {
                name: process.env.npm_package_displayName||"CastPlayer",
                author: process.env.npm_package_author_name||"CastPlayer Developers",
                version: process.env.npm_package_version||"1.0.0"
            }
        };
    
        while (args.length > 0) {
            switch(args[0]) {
                case "--in":
                    args.shift();
                    options.in = args.shift();
                    break;
                case "--use":
                    args.shift();
                    options.use = args.shift();
                    break;
                case "--out":
                    args.shift();
                    options.out = args.shift();
                    break;
                case "--suffix-version":
                    options.suffixVersion = true; 
                    args.shift();
                    break;
                default: 
                    console.error('Invalid argument:', args.shift());
                    process.exit(1);
            }
        }
    
        if (!options.in || !options.out || !options.use) {
            console.error('Usage: --in <electron-package-output> --out <msi-target-file> --use <wxs-sources> [--sufix-version]');
            process.exit(1);
        }

        if (options.suffixVersion && process.env.npm_package_version) {
            options.out = options.out.replace(/(\.[^\.]+)$/, '-' + process.env.npm_package_version + '$1');
        }

        return options;
    })(process.argv);
    
    this.binPath = (function(){
        const hasbin = require('hasbin');
        let path = '';
    
        if (!hasbin.sync('candle.exe') || !hasbin.sync('light.exe')) {
            path = 'C:\\Program Files (x86)\\WiX Toolset v3.11\\bin\\'
            if (!fs.existsSync(path + 'candle.exe') || !fs.existsSync(path + 'light.exe')) {
                console.error('This script requires WIX Toolset to be installed. However, the executables in the toolkit can\'t be located. Exiting.');
                process.exit(1);
            }
        }
    
        return path;
    })();
    
    this.build = function() {
    
        const files = require('glob').sync(this.options.use);
        const opts = {windowsHide: true};
        const args = ['-nologo', '-arch', 'x64', 
            `-dBuild=${this.options.in.replace(/\//g, '\\')}`, 
            `-dProductName=${this.options.meta.name}`, 
            `-dProductAuthor=${this.options.meta.author}`, 
            `-dProductVersion=${this.options.meta.version}`, 
            '-out', this.options.tmp].concat(files);

        //console.debug(this.binPath + 'candle.exe', args.join(' '));

        const proc = spawn(this.binPath + 'candle.exe', args, opts);
        proc.stdout.on('data', (data) => console.log('  >', data.toString()));
        proc.stderr.on('data', (data) => console.error('  >', data.toString()));
        proc.on('exit', (code) => {
            if (code !== 0 || !fs.existsSync(this.options.tmp)) {
                console.error(`Transformation failed: ${this.options.in} => ${this.options.tmp}`);
                process.exit(2);
            }
            
            const args = ['-nologo', '-sw1076', '-o', this.options.out.replace(/\//g, '\\'), this.options.tmp]

            console.log(`Transformation successful: ${this.options.in.replace(/\//g, '\\')} => ${this.options.tmp}`);
            //console.debug(this.binPath + 'light.exe', args.join(' '));
    
            const proc = spawn(this.binPath + 'light.exe', args, opts);
            proc.stdout.on('data', (data) => console.log('  >', data.toString()));
            proc.stderr.on('data', (data) => console.error('  >', data.toString()));
            proc.on('exit', (code) => {
                if (code !== 0|| !fs.existsSync(this.options.out)) {
                    console.error(`Transformation failed: ${this.options.tmp} => ${this.options.out}`);
                    process.exit(2);
                }

                console.log(`Transformation successful: ${this.options.tmp} => ${this.options.out}`);
            });
        });

        return this;
    };

    return this;
})().build();
