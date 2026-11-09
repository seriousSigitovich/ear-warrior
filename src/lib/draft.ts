// Draft mode on the answer board (spec 008): while it is on, a fret tap only sounds — nothing is placed,
// graded or stored. Pure state for one visit to the practice screen: whether draft is on, and whether it
// was on while answering the current phrase (sent as `draft` on that phrase's `answer_check`).

export interface DraftState {
  on: boolean;
  /** Draft was on at some point since this phrase started or was last checked. */
  usedOnPhrase: boolean;
}

/** Every visit starts with draft off, so practice never opens with taps silently not answering. */
export function initialDraft(): DraftState {
  return { on: false, usedOnPhrase: false };
}

/** Flip draft. `track` is true when it was switched on: the caller sends `draft_on`. */
export function toggleDraft(state: DraftState): { state: DraftState; track: boolean } {
  const on = !state.on;
  return { state: { on, usedOnPhrase: state.usedOnPhrase || on }, track: on };
}

/** A phrase was checked: report whether draft was used on it, and count the next try afresh. */
export function draftPhraseChecked(state: DraftState): { draft: boolean; state: DraftState } {
  return { draft: state.usedOnPhrase, state: { on: state.on, usedOnPhrase: state.on } };
}

/** A new phrase is on screen: it counts as drafted only if draft is still on. */
export function draftPhraseStarted(state: DraftState): DraftState {
  return { on: state.on, usedOnPhrase: state.on };
}
