#!/bin/sh
# Renders the rank icons (assets/ranks/<rank id>.svg, drawn by hand in the Nocturne palette) to the
# 256 px PNGs the app bundles. Needs rsvg-convert (brew install librsvg). The PNGs are committed, so
# this only has to run when an icon changes.
set -e
cd "$(dirname "$0")/../assets/ranks"
for svg in *.svg; do
  rsvg-convert -w 256 -h 256 "$svg" -o "${svg%.svg}.png"
done
ls -1 *.png
