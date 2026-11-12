# Cut the second Emma sheet (twinkle/emma-sheet.webp: 21 labelled poses on a cream background, no alpha) into transparent sprites
# public/twinkle/em_<name>.png (+ their entries in twinkle/sprites.json). The background is the cream colour (flood of ≤6 per channel,
# components > 150 px), the label pills and the baked-in "Again!" bubble are dropped, the grey floor shadow is dropped (the room has its own),
# each pose is its main component plus the small marks (notes, sparks, heart, scribble) that sit next to it, eroded 1 px against the cream
# fringe and saved 4× larger (Lanczos on premultiplied colour). Also saves em_poses.json: per-pose offsets that align the xylophone base.
# usage: python cut-emma.py <sheet.webp> <outDir> <sprites.json>
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open(sys.argv[1]).convert('RGB')
rgb = np.array(im).astype(int)
bg = np.array([252, 248, 245])
cand = np.abs(rgb - bg).max(axis=2) <= 6
lab, n = ndimage.label(cand)
sizes = ndimage.sum(cand, lab, range(1, n + 1))
bgm = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 150])
fg = ndimage.binary_opening(~bgm, np.ones((2, 2)))
flab, fn = ndimage.label(ndimage.binary_closing(fg, np.ones((3, 3))))
objs = ndimage.find_objects(flab)

# main components (x of their bbox start, y) → pose name
MAIN = {'idle': (8, 85), 'excited': (212, 73), 'pointing': (432, 92), 'sitting': (628, 117), 'ready': (848, 113), 'focused': (1064, 108), 'loop': (1301, 113),
        'p1': (15, 433), 'p2': (232, 431), 'p3': (440, 433), 'p4': (658, 431), 'p5': (872, 433), 'happy': (1103, 405), 'lookdad': (1320, 437),
        'curious': (14, 744), 'thinking': (240, 749), 'frustrated': (462, 744), 'tired': (684, 752), 'shy': (884, 747), 'surprised': (1072, 732), 'again': (1288, 755)}
comps = {}
for i, o in enumerate(objs, 1):
    area = int((flab == i).sum())
    if area < 25: continue
    comps[i] = (o[1].start, o[0].start, o[1].stop, o[0].stop, area)
main_id = {}
for name, (x, y) in MAIN.items():
    main_id[name] = min(comps, key=lambda i: abs(comps[i][0] - x) + abs(comps[i][1] - y))
label_ids = {i for i, (x0, y0, x1, y1, a) in comps.items() if 26 <= y1 - y0 <= 36 and 60 <= x1 - x0 <= 160 and (y0 < 60 or 365 < y0 < 410 or 680 < y0 < 720)}
bubble = {i for i, (x0, y0, x1, y1, a) in comps.items() if 1360 <= x0 <= 1380 and 660 <= y0 <= 690}
small = [i for i in comps if i not in main_id.values() and i not in label_ids and i not in bubble]
owner = {}
for i in small:
    x0, y0, x1, y1, a = comps[i]
    best = None
    for name, m in main_id.items():
        mx0, my0, mx1, my1, _ = comps[m]
        dx = max(mx0 - x1, x0 - mx1, 0); dy = max(my0 - y1, y0 - my1, 0)
        d = dx + dy
        if best is None or d < best[0]: best = (d, name)
    owner[i] = best[1]
print('attached', {i: owner[i] for i in owner})

out = {}
for name, m in main_id.items():
    ids = [m] + [i for i in owner if owner[i] == name]
    mask = np.isin(flab, ids) & fg
    # drop the grey floor shadow (low saturation, mid-grey, lavender) in the lower fifth of the main component
    x0, y0, x1, y1, _ = comps[m]
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    low = (y0 + (y1 - y0) * 0.78)
    yy = np.arange(rgb.shape[0])[:, None] * np.ones((1, rgb.shape[1]))
    shadow = (sat < 28) & (rgb.max(axis=2) < 232) & (rgb.max(axis=2) > 150) & (yy > low)
    mask &= ~shadow
    mask = ndimage.binary_erosion(mask, iterations=1)
    # defringe: a 2 px rim of pale, unsaturated pixels is cream left from the background (outlines are dark, so a legitimate rim is not pale)
    rim = mask & ~ndimage.binary_erosion(mask, iterations=2)
    pale = (rgb.min(axis=2) > 205) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 50)
    mask &= ~(rim & pale)
    ys, xs = np.nonzero(mask)
    bx0, bx1, by0, by1 = max(0, xs.min() - 2), xs.max() + 3, max(0, ys.min() - 2), ys.max() + 3
    rgba = np.dstack([rgb, np.where(mask, 255, 0)]).astype(np.uint8)[by0:by1, bx0:bx1]
    h, w = rgba.shape[:2]
    pm = rgba.astype(float); al = pm[:, :, 3:4] / 255; pm[:, :, :3] *= al
    big = Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), 'RGBA').resize((w * 4, h * 4), Image.LANCZOS)
    b = np.array(big).astype(float); ba = np.maximum(b[:, :, 3:4], 1) / 255; b[:, :, :3] = np.clip(b[:, :, :3] / ba, 0, 255)
    Image.fromarray(b.astype(np.uint8), 'RGBA').save(f'{sys.argv[2]}/em_{name}.png')
    solid = rgba[:, :, 3] > 128
    ys2, xs2 = np.nonzero(solid)
    bottom = ys2.max(); cx = float(xs2[ys2 >= bottom - 3].mean())
    out[f'em_{name}'] = {'w': int(w), 'h': int(h), 'cx': round(cx, 1), 'fy': int(bottom + 1), 'ox': int(bx0), 'oy': int(by0)}
    print(name, out[f'em_{name}'])
sp = json.load(open(sys.argv[3]))
sp.update(out)
json.dump(sp, open(sys.argv[3], 'w'), indent=1)
