import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { GAMIFICATION } from '../../../src/config/gamification';

const root = join(__dirname, '../../..');

describe('rank icons', () => {
  test('every rank has its drawing and its rendered PNG', () => {
    for (const rank of GAMIFICATION.ranks) {
      expect(existsSync(join(root, 'assets/ranks', `${rank.id}.svg`))).toBe(true);
      expect(existsSync(join(root, 'assets/ranks', `${rank.id}.png`))).toBe(true);
    }
  });

  test('every rank is listed in the bundle map, and no icon is listed for a rank that does not exist', () => {
    const source = readFileSync(join(root, 'src/components/gamification/rankIcons.ts'), 'utf8');
    const listed = [...source.matchAll(/assets\/ranks\/([a-z]+)\.png/g)].map((m) => m[1]);
    expect(listed.sort()).toEqual(GAMIFICATION.ranks.map((r) => r.id).sort());
  });
});
