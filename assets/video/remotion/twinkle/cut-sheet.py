# Cut the Tab Guy ep. 4 character sheet (twinkle/sheet.webp: Tab Guy poses + heads, Emma poses + heads, props) into transparent PNG
# sprites public/twinkle/<name>.png and write twinkle/sprites.json (size + foot/anchor point). The sheet is RGBA with a transparent
# background, so the cut is the alpha channel: components are found at alpha > 128 (closed 7 px so thin strokes join), each sprite is a
# list of components (small marks like the "!!" or the flower belong to their head), cropped with a 2 px margin.
# usage: python cut-sheet.py <sheet.webp> <outDir> <sprites.json>     (needs pillow, numpy, scipy)
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

img = Image.open(sys.argv[1]).convert('RGBA')
a = np.array(img)
m = a[:, :, 3] > 128
lab, n = ndimage.label(ndimage.binary_closing(m, np.ones((7, 7))))
objs = ndimage.find_objects(lab)

def comp_at(x, y):
    """id of the component whose bbox contains (x, y) and that has foreground there (searching a small window)."""
    w = lab[max(0, y - 3):y + 4, max(0, x - 3):x + 4]
    ids = [i for i in np.unique(w) if i]
    if not ids:
        raise SystemExit(f'no component at {x},{y}')
    return ids[0]

# name → seed points (x, y) inside every component that belongs to it
SPRITES = {
    'tab_stand': [(90, 200)], 'tab_sit': [(280, 150)], 'tab_think': [(450, 120)],
    'tab_h_calm': [(225, 320)], 'tab_h_shock': [(325, 320), (371, 276)], 'tab_h_think': [(427, 320)], 'tab_h_sour': [(520, 320)],
    'emma_stand': [(660, 170)], 'emma_play': [(830, 200)], 'emma_cheer': [(990, 160)],
    'emma_h_smile': [(668, 335)], 'emma_h_glee': [(808, 335)], 'emma_h_calm': [(943, 335)], 'emma_h_shock': [(1060, 335), (1110, 297)],
    'xylo': [(1210, 120)], 'mallets': [(1218, 170)], 'phone': [(1350, 140)], 'paywall': [(1467, 135)], 'guitar': [(1218, 300)],
    'note_a': [(1347, 300)], 'note_b': [(1399, 297)], 'note_c': [(1479, 258)],
}
out = {}
for name, seeds in SPRITES.items():
    ids = set()
    for x, y in seeds:
        ids.add(int(comp_at(x, y)))
    mask = np.isin(lab, list(ids)) & ndimage.binary_dilation(m, iterations=2)
    # keep the original (soft) alpha of the pixels inside the chosen components
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = max(0, xs.min() - 2), xs.max() + 3, max(0, ys.min() - 2), ys.max() + 3
    crop = a[y0:y1, x0:x1].copy()
    crop[:, :, 3] = np.where(mask[y0:y1, x0:x1], crop[:, :, 3], 0)
    # saved 4× larger (Lanczos on premultiplied colour, so the soft edges do not grow dark halos): the video scales these 3–9×, and a smooth
    # 4× source keeps the pixel-art look without the stair-steps nearest-neighbour makes of an AI sheet that is not on a real pixel grid
    up = Image.fromarray(crop, 'RGBA')
    pm = np.array(up).astype(float); al = pm[:, :, 3:4] / 255; pm[:, :, :3] *= al
    big = Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), 'RGBA').resize((crop.shape[1] * 4, crop.shape[0] * 4), Image.LANCZOS)
    b = np.array(big).astype(float); ba = np.maximum(b[:, :, 3:4], 1) / 255; b[:, :, :3] = np.clip(b[:, :, :3] / ba, 0, 255)
    Image.fromarray(b.astype(np.uint8), 'RGBA').save(f'{sys.argv[2]}/{name}.png')
    # anchor: bottom centre of the solid pixels (the feet / the base)
    solid = crop[:, :, 3] > 128
    ys2, xs2 = np.nonzero(solid)
    bottom = ys2.max()
    cx = float(xs2[ys2 >= bottom - 3].mean())
    out[name] = {'w': int(crop.shape[1]), 'h': int(crop.shape[0]), 'cx': round(cx, 1), 'fy': int(bottom + 1), 'ids': sorted(ids)}
    print(name, out[name])
json.dump(out, open(sys.argv[3], 'w'), indent=1)
