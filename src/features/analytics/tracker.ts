// The one product-event tracker of the running app: resolves the device id lazily and sends through the
// outbox. `track` is fire-and-forget — analytics must never delay or fail the app.
import { getOrCreateDeviceId, keyValueOverRowStore } from '../../lib/deviceId';
import { KEY_VALUE_TABLE, defaultRowStore } from '../../services/storage/db';
import {
  AppEventName,
  AppEventOutbox,
  buildEventPayload,
  createAppEventOutbox,
  defaultAppEventClient,
} from '../../services/logging/eventLog';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const APP_VERSION = '0.1.0';

let outbox: AppEventOutbox | null | undefined;

/** Where the learner is right now, so `app_background` can say where they left from. */
const where: { screen: string; phase: string } = { screen: 'home', phase: '' };

export function setScreen(screen: string): void {
  where.screen = screen;
  where.phase = '';
}

/** The practice loop's phase (idle, playingMelody, awaitingInput, …); '' off the practice screen. */
export function setPhase(phase: string): void {
  where.phase = phase;
}

export function currentPlace(): { screen: string; phase: string } {
  return { ...where };
}

function getOutbox(): AppEventOutbox | null {
  if (outbox === undefined) {
    const client = defaultAppEventClient(API_URL);
    outbox = client ? createAppEventOutbox(client) : null;
  }
  return outbox;
}

export function track(name: AppEventName, props: Record<string, number | string | boolean> = {}) {
  const box = getOutbox();
  if (!box) return;
  const at = new Date(); // the moment it happened, not the moment it is flushed
  void getOrCreateDeviceId(keyValueOverRowStore(defaultRowStore(), KEY_VALUE_TABLE))
    .then((deviceId) => box.log(buildEventPayload(name, deviceId, APP_VERSION, at, props)))
    .catch(() => undefined);
}
