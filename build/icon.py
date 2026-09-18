#!/usr/bin/env python3
"""Generates DuoScore Android launcher icons — dark #0a0a0f background, red
#ef4444 rounded square, white "D" monogram (matches DuoScore site taste).

Legacy + round icons at every density, adaptive foreground (safe zone) and
adaptive background in both mipmap-* and drawable-* layouts, plus patches the
adaptive background color in colors.xml when present.

Usage:
  python3 build/icon.py --res-dir <android res dir> [--colors <colors.xml>]

Run AFTER `npx cap add android` so the res dirs exist.
"""
import argparse
import os
import re

from PIL import Image, ImageDraw, ImageFont

DARK = (10, 10, 15, 255)
RED = (239, 68, 68, 255)
WHITE = (255, 255, 255, 255)

LEGACY = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
FG = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}


def master(circle=False):
    """Legacy launcher art: dark square/circle + red rounded square + white D."""
    s = 1024
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if circle:
        d.ellipse([0, 0, s, s], fill=DARK)
    else:
        d.rectangle([0, 0, s, s], fill=DARK)
    m, rad = 150, 180
    d.rounded_rectangle([m, m, s - m, s - m], radius=rad, fill=RED)
    font = ImageFont.load_default(size=620)
    b = d.textbbox((0, 0), 'D', font=font)
    w, h = b[2] - b[0], b[3] - b[1]
    d.text(((s - w) / 2 - b[0], (s - h) / 2 - b[1]), 'D', font=font, fill=WHITE)
    return img


def foreground():
    """Adaptive foreground: red rounded square kept inside the 66% safe zone."""
    s = 1024
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m, rad = 210, 150
    d.rounded_rectangle([m, m, s - m, s - m], radius=rad, fill=RED)
    font = ImageFont.load_default(size=520)
    b = d.textbbox((0, 0), 'D', font=font)
    w, h = b[2] - b[0], b[3] - b[1]
    d.text(((s - w) / 2 - b[0], (s - h) / 2 - b[1]), 'D', font=font, fill=WHITE)
    return img


def background():
    return Image.new('RGBA', (1024, 1024), DARK)


def write(path, img, size, circle=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = img.resize((size, size), Image.LANCZOS)
    if circle:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size, size], fill=255)
        out.putalpha(mask)
    out.save(path, 'PNG')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--res-dir', required=True)
    ap.add_argument('--colors', default='')
    args = ap.parse_args()
    res = args.res_dir

    sq = master(circle=False)
    rnd = master(circle=True)
    fg = foreground()
    bg = background()

    for dens, px in LEGACY.items():
        write(os.path.join(res, 'mipmap-%s' % dens, 'ic_launcher.png'), sq, px)
        write(os.path.join(res, 'mipmap-%s' % dens, 'ic_launcher_round.png'), rnd, px, circle=True)

    for dens, px in FG.items():
        for sub in ('mipmap-%s' % dens, 'drawable-%s' % dens):
            write(os.path.join(res, sub, 'ic_launcher_foreground.png'), fg, px)
            write(os.path.join(res, sub, 'ic_launcher_background.png'), bg, px)

    if args.colors and os.path.isfile(args.colors):
        text = open(args.colors, encoding='utf-8').read()
        if 'ic_launcher_background' in text:
            text = re.sub(
                r'(?i)<color name="ic_launcher_background">[^<]+</color>',
                '<color name="ic_launcher_background">#0A0A0F</color>', text)
            open(args.colors, 'w', encoding='utf-8').write(text)

    print('icons written to', res)


if __name__ == '__main__':
    main()