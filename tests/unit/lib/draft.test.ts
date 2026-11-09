import {
  draftPhraseChecked,
  draftPhraseStarted,
  initialDraft,
  toggleDraft,
} from '../../../src/lib/draft';

describe('draft mode state', () => {
  test('starts off and unused on every visit', () => {
    expect(initialDraft()).toEqual({ on: false, usedOnPhrase: false });
  });

  test('switching on marks the phrase and asks for a draft_on event', () => {
    const { state, track } = toggleDraft(initialDraft());
    expect(state).toEqual({ on: true, usedOnPhrase: true });
    expect(track).toBe(true);
  });

  test('switching off keeps the phrase marked and sends nothing', () => {
    const on = toggleDraft(initialDraft()).state;
    const { state, track } = toggleDraft(on);
    expect(state).toEqual({ on: false, usedOnPhrase: true });
    expect(track).toBe(false);
  });

  test('a check reports whether draft was used, then counts afresh', () => {
    const used = toggleDraft(toggleDraft(initialDraft()).state).state; // on, then off
    const { draft, state } = draftPhraseChecked(used);
    expect(draft).toBe(true);
    expect(state).toEqual({ on: false, usedOnPhrase: false });
  });

  test('draft left on counts as used on the retry after a check', () => {
    const on = toggleDraft(initialDraft()).state;
    expect(draftPhraseChecked(on).state).toEqual({ on: true, usedOnPhrase: true });
  });

  test('a phrase never drafted reports false', () => {
    expect(draftPhraseChecked(initialDraft()).draft).toBe(false);
  });

  test('a new phrase is marked used only while draft is on', () => {
    expect(draftPhraseStarted({ on: false, usedOnPhrase: true })).toEqual({
      on: false,
      usedOnPhrase: false,
    });
    expect(draftPhraseStarted({ on: true, usedOnPhrase: false })).toEqual({
      on: true,
      usedOnPhrase: true,
    });
  });
});
