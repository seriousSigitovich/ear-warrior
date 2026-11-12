# Head close-ups of the new Emma: the top part of three poses (cut-emma.py's em_*.png), saved as em_h_<name>.png with their sprites.json entries
# (the bottom edge is faded out by the video). usage: python heads-emma.py <pngDir> <sprites.json>   (run after cut-emma.py and align-emma.py)
import json, sys
from PIL import Image
d, sj = sys.argv[1], sys.argv[2]
sp = json.load(open(sj))
for name, pose, fh, fw in [('calm', 'idle', 0.47, 1.0), ('glee', 'pointing', 0.45, 0.86), ('five', 'p5', 0.52, 0.9)]:
    im = Image.open(f'{d}/em_{pose}.png'); w, h = im.size
    c = im.crop((0, 0, int(w * fw), int(h * fh))); c.save(f'{d}/em_h_{name}.png')
    cw, ch = c.size
    sp[f'em_h_{name}'] = {'w': cw // 4, 'h': ch // 4, 'cx': round(cw / 8, 1), 'fy': ch // 4}
    print(name, sp[f'em_h_{name}'])
json.dump(sp, open(sj, 'w'), indent=1)
