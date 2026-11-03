// The Rising Sun band cut (#71's arpeggio, a 10 s loop): the beat grid the band plays on and the camera's slides. The melody and the
// "your turn" times are king/tunes.mjs's `risingBand`; this adds what only the band needs. Read by src/rising/RisingBand.tsx and rising/audio.mjs.
// Eight bars of 6/8 fill the film exactly: seven carry the melody (Am C D F Am E, the home Am strum), the eighth is the band's E that
// leads back into bar 1, so the loop never stops.
import { TUNES } from '../king/tunes.mjs';

export const S = TUNES.risingBand;
export const BAR = 3 * S.BEAT;                                   // six eighths, two dotted-quarter beats
export const EIGHTH = BAR / 6;
export const BARS = Array.from({ length: Math.round(S.DURATION / BAR) }, (_, i) => i * BAR);
export const BEATS = BARS.flatMap((t) => [t, t + BAR / 2]);
export const HOME = BARS[6];                                     // the home Am strum: the melody's last note
/** Bass under each bar: root on beat 1, the fifth on beat 2. */
export const ROOTS = [[33, 40], [36, 43], [38, 45], [29, 36], [33, 40], [28, 35], [33, 40], [28, 35]];
const E = [40, 47, 52, 56, 59, 64];
/** The turnaround's soft strums after the home chord: E, back into the top. */
export const VAMP = [{ t: BARS[7], chord: E }, { t: BARS[7] + BAR / 2, chord: E }];
/** A snare pickup on the last three eighths, into bar 1. */
export const FILL = [3, 2, 1].map((k) => S.DURATION - k * EIGHTH);
/** The camera: down to the neck (the band docks at the top), the band leaves for "your turn", and comes back for the loop. */
export const DOCK = 2.45, LEAVE = S.T.hold + 0.1, BACK = S.DURATION - 0.7;
