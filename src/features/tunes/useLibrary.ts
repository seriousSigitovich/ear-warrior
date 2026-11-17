// Re-renders a screen when the library is replaced (a newer catalog arrived).
import { useSyncExternalStore } from 'react';
import { libraryVersion, onLibraryChange } from '../../services/tunes/library';

export function useLibraryVersion(): number {
  return useSyncExternalStore(onLibraryChange, libraryVersion, libraryVersion);
}
