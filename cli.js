#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const meow = require('meow');
const json2css = require('json2css');
const handlebars = require('handlebars');
const Imagemin = require('imagemin');
const Spirtesmith = require('spritesmith');

const errors = {
    no_icon: `
  Can not found any icons. Try:

  $ runhua --help
    `
};
const cli = meow(`
    Usage
      $ ruhua <file> <file> ... <file>
      $ ruhua <directory> --css <output> --img <output>

    Options
      -c, --css       Output css
      -i, --img       Output img
      -r, --ratio     CSS resize ratio (2x/0.5, 3x/0.33, 4x/0.25)
      -R, --recursive Attemp to read image recursively
      -v, --verbose   Log error message
      -p, --pad       Add padding between images

    Examples
      $ ruhua sprites/
      $ ruhua sprites/ --css dist/sprite.css --img dist/sprite.png
      $ ruhua sprites/ --ratio .5 --pad 5
`, {
    boolean: [
        'verbose',
        'recursive'
    ],
    string: [
        'css',
        'img',
        'ratio',
        'pad'
    ],
    alias: {
        c: 'css',
        i: 'img',
        r: 'ratio',
        R: 'recursive',
        v: 'verbose',
        p: 'pad'
    }
});

run();

/**
 * Apply default config
 *
 */
function applyDefaultConfig () {
    cli.flags.img = cli.flags.img || path.resolve(process.cwd(), 'sprite.png');
    cli.flags.css = cli.flags.css || path.resolve(process.cwd(), 'sprite.css');
    cli.flags.ratio = parseFloat(cli.flags.ratio, 10) || 1;
}

/**
 * Detect whether source file path is image path
 *
 * @param {String} path
 * @return {Boolean}
 */
function isImgPath (inputPath) {
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
                } else if (isImgPath(subPath)) {
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
        inputPathList.push(process.cwd());
    }

    return new Promise(function (resolve, reject) {
        var waitsList = [];
        var snapshotWatisList = null;
        var srcPathList = [];

        function resolveSubSrcPathList () {
            if (waitsList.length) {
                Promise.all(waitsList.slice(0)).then(resolveSubSrcPathList);
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
            } else if (isImgPath(inputPath)) {
                srcPathList.push(inputPath);
            }
        });

        resolveSubSrcPathList();
    });
}

function run () {
    applyDefaultConfig();
    resolveSrcPathList()
        .then(function (srcPathList) {
            if (!srcPathList.length) {
                throw new Error(errors.no_icon);
            }

            return new Promise(function (resolve, reject) {
                Spirtesmith.run({
                    src: srcPathList,
                    padding: cli.flags.pad || 0
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

                    result.ratio = files[0].contents.length / result.image.length;
                    result.image = files[0].contents;
                    resolve(result);
                });
            });
        })
        .then(function (result) {
            var ruleList = [];
            var props = result.properties;
            var coords = result.coordinates;
            var resizeRatio = cli.flags.ratio;

            Object.keys(coords).sort().forEach(function (srcPath) {
                var rule = coords[srcPath];

                rule.name = path.basename(srcPath).replace(path.extname(srcPath), '');
                rule.image = cli.flags.img;
                rule.x = rule.x * resizeRatio;
                rule.y = rule.y * resizeRatio;
                rule.width = rule.width * resizeRatio;
                rule.height = rule.height * resizeRatio;
                rule.total_width = props.width * resizeRatio;
                rule.total_height = props.height * resizeRatio;
                ruleList.push(rule);
            });

            json2css.addTemplate('ruhua', function (data) {
                var tpl = fs.readFileSync(
                    path.resolve(__dirname, 'templates', 'ruhua.template.handlebars'), 'utf8'
                );

                data.global = {
                    px: {
                        total_width: data.items[0].px.total_width,
                        total_height: data.items[0].px.total_height
                    },
                    image: data.items[0].image
                };

                return handlebars.compile(tpl)(data);
            });

            return new Promise(function (resolve, reject) {
                result.css = json2css(ruleList, {
                    format: 'ruhua'
                });

               resolve(result);
            });
        })
        .then(function (result) {
            fs.writeFile(cli.flags.css, result.css);
            fs.writeFile(cli.flags.img, result.image);
        })
        .catch(function (err) {
            console.log(err.message);
        });
}

