# Cut the mod-suit band sheet (rising/sheet.webp: vocalist / guitarist / guitarist 2 / bassist / drummer, one row of poses each, on a
# transparent ground) into PNG sprites public/mods/<who>_<n>.png and their anchors in rising/sprites.json: w, h and cx, the x of the feet
# (mean of the opaque pixels in the bottom 14 rows), so a pose swap keeps the figure standing in place. The right-hand extras are not cut.
# usage: python cut-sheet.py <sheet> <outDir> <sprites.json>      (needs pillow, numpy, scipy)
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROWS = {'vocalist': (0, 230), 'guitarist': (230, 432), 'guitarist2': (432, 621), 'bassist': (621, 815), 'drummer': (815, 1010)}
X0, X1 = 112, 1290

rgba = np.array(Image.open(sys.argv[1]).convert('RGBA'))
anchors = {}
for who, (y0, y1) in ROWS.items():
    band = rgba[y0:y1, X0:X1]
    solid = band[:, :, 3] > 60
    lab, _ = ndimage.label(ndimage.binary_dilation(solid, iterations=3))
    boxes = sorted((o for o in ndimage.find_objects(lab) if o[0].stop - o[0].start > 100), key=lambda o: o[1].start)
    for n, (ys, xs) in enumerate(boxes):
        cell = band[ys, xs].copy()
        cell[~solid[ys, xs]] = 0 if cell.dtype == np.uint8 else cell[~solid[ys, xs]]
        cell[:, :, 3] = np.where(solid[ys, xs], band[ys, xs][:, :, 3], 0)
        a = cell[:, :, 3] > 60
        rows, cols = np.nonzero(a)
        cell = cell[rows.min():rows.max() + 1, cols.min():cols.max() + 1]
        a = cell[:, :, 3] > 60
        fx = np.nonzero(a[-14:])[1]
        Image.fromarray(cell, 'RGBA').save(f'{sys.argv[2]}/{who}_{n}.png')
        anchors[f'{who}_{n}'] = {'w': int(cell.shape[1]), 'h': int(cell.shape[0]), 'cx': round(float(fx.mean()), 1)}
        print(who, n, cell.shape[1], 'x', cell.shape[0], 'cx', anchors[f'{who}_{n}']['cx'])
json.dump(anchors, open(sys.argv[3], 'w'), indent=1)
