(function() {

    if (process.platform !== 'win32') {
        console.error('This script can only be run on Windows. Exiting.');
        process.exit(1);
    }

    const archiver = require('archiver');
    const fs = require('fs');

    this.options = (function(argv){
        let args = argv; args.shift(); args.shift();
    
        console.log('Creating archive with the following arguments:', args.join(' '));
        let options = {
            in: null,
            out: null,
            format: 'zip',
            base: ''
        };
    
        while (args.length > 0) {
            switch(args[0]) {
                case "--in":
                    args.shift();
                    options.in = args.shift();
                    break;
                case "--out":
                    args.shift();
                    options.out = args.shift();
                    break;
                case "--base":
                    args.shift();
                    options.base = args.shift();
                    break;
                case "--format":
                    args.shift();
                    options.format = args.shift();
                    break;
                default: 
                    console.error('Invalid argument:', args.shift());
                    process.exit(1);
            }
        }
    
        if (!options.in || !options.out) {
            console.error('Usage: --in <electron-package-output> --out <zip-target-file> [--format zip|tar] [--base <zip-base-path>]');
            process.exit(1);
        }

        return options;
    })(process.argv);
    
    this.build = function() {
    
        var stream = fs.createWriteStream(this.options.out);
        var archive = archiver(this.options.format, {gzip:true, zlib:{level:9}});
        const self = this;

        stream.on('close', function() {
            console.log(`Transformation successful: ${self.options.in} => ${self.options.out}`);
            process.exit(0);
        });

        archive.on('error', function() {
            console.error(`Transformation failed: ${self.options.in} => ${self.options.out}`);
            process.exit(2);
        });

        archive.on('warning', function(err) {
            if (err.code === 'ENOENT') {
                console.warn(err);
            } else {
                console.error(`Transformation failed: ${self.options.in} => ${self.options.out}`);
                process.exit(2);
            }
        });

        archive.pipe(stream);
        archive.glob(this.options.in, {cwd: this.options.base});
        archive.finalize();

        return this;
    };

    return this;
})().build();
