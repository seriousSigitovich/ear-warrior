import { createMemoryTuneStore } from './memoryStore.js';
import { runTuneContract } from './store.contract.js';

runTuneContract('memory', async () => createMemoryTuneStore());
