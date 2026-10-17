// Writes docs/lesson-silent-night-voiceover.md from script.mjs: every narration line with the second it starts and a pace check.
// Usage: node voiceover.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SCENES, DUR } from './script.mjs';

const WPM = 150; // calm, instructional pace
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.round((s % 1) * 10)}`;
const words = t => t.trim().split(/\s+/).length;

let md = `# Voice-over — Silent Night lesson (${Math.floor(DUR / 60)}:${String(DUR % 60).padStart(2, '0')})\n\n`;
md += `Record this in English over \`silent-night-lesson.mp4\`. **Start each line at the time shown** — the picture and the guitar are already timed to those starts, so you stay in sync line by line even if your pace differs a little. The "ends" column is when the line finishes at ${WPM} words per minute; it must be before the next start. Scenes are in order; where there is a gap, the guitar is playing — stay quiet.\n\n`;
md += `**Tip:** record each scene as its own take (\`1-hook\`, \`2-listen\`, …) or each line, so a retake does not cost the whole video.\n\n`;
let total = 0, bad = 0;
const rows = [];
SCENES.forEach((s, i) => {
  md += `## ${i + 1} · ${s.id} — ${mmss(s.start)}\n\n| Start | Line | Ends | Next start | OK |\n|---|---|---|---|---|\n`;
  s.lines.forEach(([at, text], j) => {
    const sec = (words(text) / WPM) * 60, end = at + sec, next = s.lines[j + 1]?.[0] ?? s.dur;
    const ok = end <= next + 0.05;
    total += words(text); if (!ok) bad++;
    md += `| ${mmss(s.start + at)} | ${text} | ${mmss(s.start + end)} | ${mmss(s.start + next)} | ${ok ? 'yes' : 'TOO LONG'} |\n`;
  });
  md += `\n`;
});
md += `Total: ${total} words, ${bad ? bad + ' line(s) too long' : 'every line fits'}.\n\n---\n\n`;
md += `**Plain script (read top to bottom):**\n\n`;
SCENES.forEach(s => { md += s.lines.map(l => l[1]).join(' ') + '\n\n'; });
md += `---\n\n**Do not say:** "easy", exclamation-mark energy, or any number that is not on screen. Say “Not quite” flat and kind — it is a normal part of picking a tune, not a failure (docs/voice.md).\n`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
writeFileSync(join(root, 'docs', 'lesson-silent-night-voiceover.md'), md);
console.log(`${total} words; ${bad} line(s) too long`);
