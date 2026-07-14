import { restoreFromBackup, type BackupData } from './db';
import backupData from '../data/jimwas-backup-2026-07-14.json';

export async function populateDatabase() {
  try {
    const backup = backupData as unknown as BackupData;
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
