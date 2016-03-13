#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const meow = require('meow');
const Imagemin = require('imagemin');
const Spirtesmith = require('spritesmith');

const cli = meow(`
    Usage
      $ flowery <file> <file> ... <file>
      $ flowery <directory> --css <output> --img <output>

    Options
      -c, --css       Output css
      -i, --img       Output img
      -r, --ratio     CSS position resize ratio
      -R, --recursive Attemp to read image recursively
      -v, --verbose   Log error message

    Examples
      $ flowery sprites/
      $ flowery sprites/ --css dist/sprite.css --img dist/sprite.png
      $ flowery sprites/ --ratio .5
`, {
    boolean: [
        'verbose',
        'recursive'
    ],
    string: [
        'css',
        'img',
        'ratio'
    ],
    alias: {
        c: 'css',
        i: 'img',
        r: 'ratio',
        R: 'recursive',
        v: 'verbose'
    },
    defaults: {
        css: 'hahaha'
    }
});

run();

/**
 * Apply default config
 *
 */
function applyDefaultConfig () {
    cli.flags.img = cli.flags.img || './sprite.png';
    cli.flags.css = cli.flags.css || './sprite.css';
}

/**
 * Detect whether source file path is image path
 *
 * @param {String} path
 * @return {Boolean}
 */
function isImagePath (inputPath) {
    return [ '.png', '.jpg', '.gif', '.svg' ].indexOf(path.extname(inputPath)) > -1;
}

/**
 * Detect whether source path is directory path
 *
 * @param {String} path
 * @return {Boolean}
 */
function isDirPath (inputPath) {
    return path.extname(inputPath) === '';
}

/**
 * Get source path list in directory
 *
 * @param {String} directory path
 * @param {Array} resolved path list
 * @param {Array} waits promise list
 * @param {Boolean}
 * @return {Promise}
 */
function resolveSrcPathListInDir (dirPath, srcPathList, waitsList, recursive) {
    if (dirPath.substr(-1) !== '/') {
        dirPath += '/';
    }

    return new Promise(function (resolve, reject) {
        fs.readdir(dirPath, function (err, result) {
            if (err) {
                if (cli.flags.verbose) {
                    console.log(err.message);
                }

                return resolve();
            }

            result.forEach(function (subPath) {
                subPath = path.resolve(dirPath, subPath);

                if (isDirPath(subPath) && recursive) {
                    waitsList.push(
                        resolveSrcPathListInDir(subPath, srcPathList, waitsList, recursive)
                    );
                } else if (isImagePath(subPath)) {
                    srcPathList.push(subPath);
                }
            });

            resolve();
        });
    });
}

/**
 * Get source files path in list
 *
 * @return {Array} source path list
 */
function resolveSrcPathList () {
    var inputPathList = cli.input.slice(0);

    if (!inputPathList.length) {
        inputPathList.push(__dirname);
    }

    return new Promise(function (resolve, reject) {
        var waitsList = [];
        var snapshotWatisList = null;
        var srcPathList = [];

        function recursive () {
            if (waitsList.length) {
                Promise.all(waitsList.slice(0)).then(recursive);
                waitsList.length = 0;
            } else {
                resolve(srcPathList);
            }
        }

        inputPathList.forEach(function (inputPath) {
            inputPath = path.resolve(inputPath);

            if (isDirPath(inputPath)) {
                waitsList.push(
                    resolveSrcPathListInDir(inputPath, srcPathList, waitsList, cli.flags.recursive)
                );
            } else if (isImagePath(inputPath)) {
                srcPathList.push(inputPath);
            }
        });

        recursive();
    });
}

function run () {
    applyDefaultConfig();
    resolveSrcPathList()
        .then(function (srcPathList) {
            return new Promise(function (resolve, reject) {
                Spirtesmith.run({
                    src: srcPathList
                }, function (err, result) {
                    if (err) {
                        throw err;
                    }

                    resolve(result);
                });
            });
        })
        .then(function (result) {
            const imagemin = new Imagemin().src(result.image);
            imagemin.use(Imagemin['optipng']());

            return new Promise(function (resolve, reject) {
                imagemin.run(function (err, files) {
                    if (err) {
                        throw err;
                    }

                    resolve(files[0].contents);
                });
            });
        })
        .then(function (contents) {
            fs.writeFile(cli.flags.img, contents);
        })
        .catch(function (err) {
            console.log(err.message);
        });
}

