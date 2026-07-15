import { getDB, getLastRestorePoint, getAllProducts, getAllCustomers } from './db';
import {
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_MPESA_SETTINGS,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_LOYALTY_SETTINGS,
  DEFAULT_RECEIPT_SETTINGS,
} from './settings-types';

/**
 * Initialize the application on first run
 * Creates default settings in IndexedDB if they don't exist
 */
export async function initializeApp(): Promise<void> {
  try {
    const db = await getDB();

    // Check if business settings exist
    const existingSettings = await db.get('business_settings', 'default');
    if (!existingSettings) {
      console.log('[v0] Initializing default business settings...');
      
      // Create all default settings in IndexedDB
      await Promise.all([
        db.put('business_settings', DEFAULT_BUSINESS_SETTINGS, 'default'),
        db.put('mpesa_settings', DEFAULT_MPESA_SETTINGS, 'default'),
        db.put('loyalty_settings', DEFAULT_LOYALTY_SETTINGS, 'default'),
        db.put('receipt_settings', DEFAULT_RECEIPT_SETTINGS, 'default'),
      ]);

      // Initialize payment methods
      for (const method of DEFAULT_PAYMENT_METHODS) {
        await db.put('payment_methods', method, method.id);
      }

      console.log('[v0] Default settings initialized successfully');
    }

    // Mark app as initialized
    sessionStorage.setItem('app_initialized', 'true');
  } catch (error) {
    console.error('[v0] Failed to initialize app:', error);
    // Don't throw - allow app to continue even if init fails
  }
}

/**
 * Check if app has been initialized in this session
 */
export function isAppInitialized(): boolean {
  return sessionStorage.getItem('app_initialized') === 'true';
}

/**
 * Check if we should attempt auto-restore from last backup
 * Returns true if:
 * - A restore point exists (previous backup was imported)
 * - Local product/customer data is empty (fresh session or IndexedDB cleared)
 */
export async function shouldAutoRestore(): Promise<boolean> {
  try {
    const restorePoint = await getLastRestorePoint();
    if (!restorePoint) {
      console.log('[v0] No restore point found, auto-restore skipped');
      return false;
    }

    // Check if we have data in the database
    const products = await getAllProducts();
    const customers = await getAllCustomers();

    if (products.length === 0 || customers.length === 0) {
      console.log('[v0] Database appears empty, auto-restore needed');
      console.log(`[v0] Restore point: ${restorePoint.product_count} products, ${restorePoint.customer_count} customers`);
      return true;
    }

    console.log('[v0] Database has data, auto-restore not needed');
    return false;
  } catch (error) {
    console.error('[v0] Error checking auto-restore status:', error);
    return false;
  }
}
