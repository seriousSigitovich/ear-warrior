# Cut the band character sheet (band/sheet.webp: drummer / guitarist / bassist × IDLE, PLAY LOOP, HIT|STRUM HARD|GROOVE, HEAD BOB, FILL|JUMP)
# into transparent PNG sprites public/band/<who>_<pose>.png. The large portraits on the left touch the sheet's edge and are not cut.
# The background is flat and dark (a faint gradient, noise ≤ 3) and the black clothes are nearly the same colour, so a plain flood fill
# leaks into the trousers. Instead: background = pixels whose whole 7×7 neighbourhood is bg-coloured (textured clothes always have a shaded
# pixel nearby), flood-filled from the cell border, then grown back 6 px through bg-coloured pixels only to restore the outline.
# usage: python cut-sheet.py <sheet> <outDir>      (needs pillow, numpy, scipy)
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

TOL = 6
WIN, GROW = 7, 6
ROWS = {'drummer': (95, 298), 'guitarist': (405, 636), 'bassist': (722, 966)}
COLS = ['idle', 'play', 'hard', 'bob', 'last']
XS = [(500, 710), (710, 905), (905, 1105), (1105, 1300), (1300, 1510)]
LAST = {'drummer': 'fill', 'guitarist': 'jump', 'bassist': 'jump'}

def cut(img, x0, y0, x1, y1):
    a = img[y0:y1, x0:x1]
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bgc = np.median(border, axis=0)
    near = np.abs(a - bgc).max(axis=2) < TOL
    flat = ndimage.binary_erosion(near, np.ones((WIN, WIN)), border_value=1)
    lab, _ = ndimage.label(flat)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = ndimage.binary_dilation(np.isin(lab, list(edge)), iterations=GROW, mask=near)
    fg = ~bg
    flab, n = ndimage.label(fg)
    sizes = ndimage.sum(fg, flab, range(1, n + 1))
    keep = np.isin(flab, [i + 1 for i, s in enumerate(sizes) if s >= 60])
    ys, xs = np.nonzero(keep)
    rgba = np.dstack([a, np.where(keep, 255, 0)]).astype(np.uint8)
    return Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA'), (x0 + xs.min(), y0 + ys.min(), y0 + ys.max())

img = np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int)
for who, (y0, y1) in ROWS.items():
    for pose, (x0, x1) in zip(COLS, XS):
        name = LAST[who] if pose == 'last' else pose
        im, box = cut(img, x0, y0, x1, y1)
        im.save(f'{sys.argv[2]}/{who}_{name}.png')
        print(who, name, im.size, 'top-left', box[:2], 'bottom', box[2])
