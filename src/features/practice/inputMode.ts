// The input mode this build answers in (FR-020, research R14). Read once from the build flag so the
// practice screen and the progress view agree on which mode's history they are showing.
import { InputMode } from '../../models';

/** Parse `EXPO_PUBLIC_INPUT_MODE`: `mic` restores the microphone pipeline, anything else is the MVP's fretboard. */
export function resolveInputMode(flag: string | undefined): InputMode {
  return flag === 'mic' ? 'mic' : 'fretboard';
}

export const INPUT_MODE: InputMode = resolveInputMode(process.env.EXPO_PUBLIC_INPUT_MODE);
