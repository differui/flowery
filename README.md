**ruhua** - A handy sprite generator for commend line.
=====

![ruhua](https://cloud.githubusercontent.com/assets/3120588/13744602/d1c7a116-ea23-11e5-96b8-b49121d6a1e5.jpg)

> 大爷，经常来玩哦。

## Install

You can get **ruhua** via npm:

```
$ npm install -g ruhua
```

## Usage

```bash
Usage
  $ ruhua <file> <file> ... <file>
  $ ruhua <directory> --css <output> --img <output>

Options
  -c, --css       Output css
  -i, --img       Output img
  -r, --ratio     CSS resize ratio (2x/0.5, 3x/0.33, 4x/0.25)
  -R, --recursive Attemp to read image recursively
  -v, --verbose   Log error message

Examples
  $ ruhua sprites/
  $ ruhua sprites/ --css dist/sprite.css --img dist/sprite.png
  $ ruhua sprites/ --ratio .5
```

**ruhua** will search icons in CWD if run without after arguments. Sprite stylesheet and image will be created in it if run without dest path.

```
$ ruhua
```

**ruhua** allows you to generate sprite image for retina device.The way is take relative CSS property multipled a ratio number.

```
$ ruhua -r 0.5 # Generate sprite image for 2X retina device
```

## License

MIT