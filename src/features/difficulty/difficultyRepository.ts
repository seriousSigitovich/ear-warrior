// The one difficulty repository every screen reads and writes (Home, Practice, Settings). Shared so a
// level picked in Settings reaches the account too, and so a load waits for a save still in flight.
import { getAuthService } from '../auth/authService';
import { defaultRowStore } from '../../services/storage/db';
import {
  DifficultySettingsRepository,
  createDifficultySettingsRepository,
} from '../../services/storage/repositories';
import { createProgressClient } from '../../services/progress/client';
import { withBackend } from '../../services/progress/difficultyRepo';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

let instance: DifficultySettingsRepository | null = null;

export function getDifficultyRepository(): DifficultySettingsRepository {
  if (!instance) {
    const local = createDifficultySettingsRepository(defaultRowStore());
    const client = createProgressClient(API_URL);
    instance = client
      ? withBackend(local, { client, getToken: () => getAuthService().getToken() })
      : local;
  }
  return instance;
}
