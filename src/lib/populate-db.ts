import { restoreFromBackup, type BackupData } from './db';

export async function populateDatabase() {
  try {
    // Fetch the backup data from the public data folder
    const response = await fetch('/data/jimwas-backup-2026-07-14.json');
    if (!response.ok) {
      throw new Error(`Failed to load backup: ${response.statusText}`);
    }
    const backup = (await response.json()) as BackupData;
    const result = await restoreFromBackup(backup);
    console.log('[v0] Database populated:', result);
    return result;
  } catch (error) {
    console.error('[v0] Database population failed:', error);
    throw error;
  }
}

// Make it accessible from window for console access
if (typeof window !== 'undefined') {
  (window as any).populateDatabase = populateDatabase;
}
