import { randomUUID } from 'node:crypto';
import { createMemoryLedgerStore } from './ledgerMemoryStore.js';
import { runLedgerContract } from './ledger.contract.js';

runLedgerContract('memory', async () => ({ store: createMemoryLedgerStore(), newUser: async () => randomUUID() }));
