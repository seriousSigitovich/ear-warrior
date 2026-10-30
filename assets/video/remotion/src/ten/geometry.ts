// The fretboard's geometry, shared by the board and the things that sit on it. Frets are spaced by the real scale-length rule
// (each fret is 2^(−1/12) of the one before), so the spacing narrows exactly as it does on a guitar.
export const FB = {
  labelW: 54,                 // string-name column left of the nut
  boardW: 780,                // nut → fret 7
  endExtra: 30,               // the neck keeps going past fret 7 (fades out)
  frets: 7,
  spacing: 60,                // string to string
  padY: 40,
  W: 864,                     // 54 + 780 + 30: exactly the central 80 % of a 1080 frame
  H: 5 * 60 + 2 * 40,
};
const SPAN = 1 - Math.pow(2, -FB.frets / 12);
/** x of fret wire n (0 = nut), in board space. */
export const fretX = (n: number) => FB.labelW + (FB.boardW * (1 - Math.pow(2, -n / 12))) / SPAN;
/** x where a fingertip sits on fret n: just behind the wire, as on a real neck. */
export const noteX = (fret: number) => fret === 0 ? FB.labelW - 26 : fretX(fret - 1) + (fretX(fret) - fretX(fret - 1)) * 0.56;
/** y of a string (0 = low E at the bottom, 5 = high E at the top, as in a tab). */
export const stringY = (s: number) => FB.padY + (5 - s) * FB.spacing;
/** String thickness in px (.010 .013 .017 .026 .036 .046, scaled), low → high. */
export const STRING_W = [7.2, 5.6, 4.4, 3.2, 2.5, 2.0];
export const WOUND = [true, true, true, false, false, false];
