# Align the xylophone of every seated Emma pose to p1's: both are placed with their (cx, fy) anchor, then the lower 30 % of the silhouette (the
# xylophone, mostly) is slid ±14 px until the overlap is greatest; the anchor of the pose is moved by that shift (cx, fy in sprites.json).
# usage: python align-emma.py <pngDir> <sprites.json>
import json, sys
import numpy as np
from PIL import Image
d, sj = sys.argv[1], sys.argv[2]
sp = json.load(open(sj))
def low(n):
    a = np.array(Image.open(f'{d}/em_{n}.png'))[:, :, 3] > 128
    a = np.array(Image.fromarray((a * 255).astype(np.uint8)).resize((a.shape[1] // 4, a.shape[0] // 4), Image.BOX)) > 100
    m = sp['em_' + n]; H = a.shape[0]
    # canvas in anchor coordinates: x - cx, y - fy; rows only from fy-0.30*h to fy
    top = int(m['fy'] - 0.30 * m['h'])
    return a, m, top
ref, rm, rtop = low('p1')
def canvas(a, m, top):
    c = np.zeros((90, 400), bool)   # y: -80..10 relative to fy, x: -200..200
    for y in range(max(top, 0), min(a.shape[0], m['fy'] + 10)):
        for x in range(a.shape[1]):
            if a[y, x]:
                yy = y - m['fy'] + 80; xx = int(round(x - m['cx'])) + 200
                if 0 <= yy < 90 and 0 <= xx < 400: c[yy, xx] = True
    return c
R = canvas(ref, rm, rtop)
res = {}
for n in ['ready', 'focused', 'loop', 'p1', 'p2', 'p3', 'p4', 'p5', 'happy', 'lookdad', 'surprised', 'frustrated', 'shy', 'thinking']:
    a, m, top = low(n); C = canvas(a, m, top)
    best = None
    for dy in range(-14, 15):
        for dx in range(-14, 15):
            s = np.roll(np.roll(C, dy, 0), dx, 1)
            sc = (s & R).sum() / max(1, (s | R).sum())
            if best is None or sc > best[0]: best = (sc, dx, dy)
    res[n] = best
    print(n, round(best[0], 2), best[1], best[2])
    m['cx'] = round(m['cx'] - best[1], 1); m['fy'] = int(m['fy'] - best[2])
json.dump(sp, open(sj, 'w'), indent=1)
