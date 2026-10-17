import { BW, BH, cellCenter } from './Board';
import { clamp, easeOut, lerp } from './util';
import type { Note } from '../tune.mjs';

export interface Cam { x: number; y: number; k: number }

/**
 * Per-frame camera over the board: eases toward the cell of the latest note and zooms in over `zoomFrames`.
 * Built by iterating from frame 0 so any frame can be rendered on its own (Remotion renders frames independently).
 */
export function buildCamera(notes: Note[], startSec: number, frames: number, fps: number, zoom: number, follow: number, smooth = 0.09): Cam[] {
  const out: Cam[] = [];
  let px = BW / 2, py = BH / 2;
  for (let i = 0; i <= frames; i++) {
    const t = startSec + i / fps;
    let tx = BW / 2, ty = BH / 2;
    for (const n of notes) {
      if (n.t <= t + 0.04) {
        const c = cellCenter(n.s, n.f);
        tx = lerp(BW / 2, c.x, follow);
        ty = lerp(BH / 2, c.y, follow);
      }
    }
    px += (tx - px) * smooth;
    py += (ty - py) * smooth;
    const k = lerp(1, zoom, easeOut(i / 26));
    out.push({ k, x: clamp(BW / 2 - k * px, BW - k * BW, 0), y: clamp(BH / 2 - k * py, BH - k * BH, 0) });
  }
  return out;
}
