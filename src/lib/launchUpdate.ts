// OTA updates without blocking the launch. expo-updates by default runs a downloaded update only at the NEXT launch,
// so a fix reached the user after their second open. Here the download starts at once, in the background, and the
// downloaded bundle is switched in the moment the app goes to the background — the learner never sees the restart,
// and the next time they open the app it is already the new version.

export interface UpdatesApi {
  checkForUpdateAsync(): Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync(): Promise<{ isNew: boolean }>;
  reloadAsync(): Promise<void>;
}

export class BackgroundUpdater {
  private ready = false;
  private busy = false;

  constructor(private readonly api: UpdatesApi) {}

  /** Asks the server and downloads what is new. Never throws; a failure just leaves the current bundle. */
  async check(): Promise<'ready' | 'none' | 'error'> {
    if (this.ready) return 'ready';
    if (this.busy) return 'none';
    this.busy = true;
    try {
      if (!(await this.api.checkForUpdateAsync()).isAvailable) return 'none';
      if (!(await this.api.fetchUpdateAsync()).isNew) return 'none';
      this.ready = true;
      return 'ready';
    } catch {
      return 'error';
    } finally {
      this.busy = false;
    }
  }

  /** Call when the app leaves the screen: switches to the downloaded bundle if there is one. */
  async applyIfReady(): Promise<boolean> {
    if (!this.ready) return false;
    try {
      await this.api.reloadAsync();
      return true;
    } catch {
      return false;
    }
  }
}
