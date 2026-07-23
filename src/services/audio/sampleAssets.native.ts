// Bundled sample asset registry (device build). Metro resolves `require` of asset files to numeric
// module ids; map each sample filename (from samples.ts) to its require here once the audio files are
// added under assets/samples/. Kept empty in the scaffold — populate alongside the bundled samples (T025).
//
// Example once assets exist:
//   export const SAMPLE_ASSETS: Record<string, number> = {
//     'e4.mp3': require('../../../assets/samples/e4.mp3'),
//     'g4.mp3': require('../../../assets/samples/g4.mp3'),
//   };
export const SAMPLE_ASSETS: Record<string, number> = {};
