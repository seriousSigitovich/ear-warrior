#!/bin/sh
# Renders Home's bottom-bar icons (assets/nav/<name>.svg) to the 96 px PNGs the app bundles. The SVGs are
# Tabler Icons (outline, MIT licence, https://tabler.io/icons) recoloured to the Nocturne accent ramp 400.
# Needs rsvg-convert (brew install librsvg). The PNGs are committed, so this only has to run when an icon
# changes.
set -e
cd "$(dirname "$0")/../assets/nav"
for svg in *.svg; do
  rsvg-convert -w 96 -h 96 "$svg" -o "${svg%.svg}.png"
done
ls -1 *.png
