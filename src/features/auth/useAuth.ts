// React binding for the auth service: the current state, re-rendering when it changes.
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { AuthState } from '../../services/auth/service';
import { ensureAuthReady, getAuthService } from './authService';

export function useAuth(): { state: AuthState; available: boolean } {
  const service = getAuthService();
  const state = useSyncExternalStore(service.onAuthChange, service.getState);
  return { state, available: service.available };
}

/** Mounted once at the root: restores the session at start and re-checks it after a long background spell. */
export function useAuthLifecycle(): void {
  useEffect(() => {
    void ensureAuthReady();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void getAuthService().revalidateIfStale();
    });
    return () => sub.remove();
  }, []);
}
