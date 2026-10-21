import { createMemoryStore } from './memoryStore.js';
import { runStoreContract } from './store.contract.js';

runStoreContract('memory', async () => createMemoryStore());
