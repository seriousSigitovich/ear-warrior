// The one device-id getter of the running app. Analytics and sign-in both ask for the id, often in the
// same second on first launch, so they must share one source or each mints its own id.
import { createDeviceIdSource, keyValueOverRowStore } from '../../lib/deviceId';
import { KEY_VALUE_TABLE, defaultRowStore } from '../../services/storage/db';

let source: (() => Promise<string>) | undefined;

export function appDeviceId(): Promise<string> {
  if (!source) {
    source = createDeviceIdSource(keyValueOverRowStore(defaultRowStore(), KEY_VALUE_TABLE));
  }
  return source();
}
