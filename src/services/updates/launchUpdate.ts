// Native glue for src/lib/launchUpdate.ts: only a release build with updates enabled asks the server.
import * as Updates from 'expo-updates';
import { BackgroundUpdater } from '../../lib/launchUpdate';

let updater: BackgroundUpdater | null = null;

/** Null in dev and wherever updates are off. */
export function getUpdater(): BackgroundUpdater | null {
  if (__DEV__ || !Updates.isEnabled) return null;
  if (!updater) updater = new BackgroundUpdater(Updates);
  return updater;
}
