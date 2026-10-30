import { randomUUID } from 'node:crypto';
import { createMemoryProgressStore } from './memoryStore.js';
import { runProgressContract } from './store.contract.js';

runProgressContract('memory', async () => ({ store: createMemoryProgressStore(), newUser: async () => randomUUID() }));
