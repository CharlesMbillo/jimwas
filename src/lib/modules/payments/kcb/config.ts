/**
 * KCB Configuration Manager
 * Loads and validates configuration from Supabase settings
 * (Vite frontend app - no server-side env vars available)
 */

import type { KCBConfig } from './types';
import type { KCBSettings } from '../../settings-types';
import { KCB_API_DEFAULTS } from './constants';
import { getSupabase } from '../../../sync';

class ConfigManager {
  private config: KCBConfig | null = null;
  private validated = false;
  private supabaseSettings: KCBSettings | null = null;

  /**
   * Load KCB settings from Supabase (only done once)
   */
  async loadSupabaseSettings(): Promise<KCBSettings> {
    if (this.supabaseSettings) {
      return this.supabaseSettings;
    }

    try {
      console.log('[v0] Attempting to load KCB settings from Supabase...');
      const supabase = getSupabase();
      
      if (!supabase) {
        console.error('[v0] Supabase client initialization failed');
        console.error('[v0] Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.development.local');
        throw new Error(
          'Supabase not configured. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are set.'
        );
      }

      console.log('[v0] Supabase client initialized. Querying kcb_settings table...');
      const { data, error } = await supabase
        .from('kcb_settings')
        .select('*')
        .eq('id', 'kcb-settings')
        .single();

      if (error) {
        console.error('[v0] Supabase query error:', error);
        if (error.code === 'PGRST116') {
          throw new Error(
            'KCB settings not found in database. Please configure KCB in Settings > Payments.'
          );
        }
        throw new Error(`Failed to load KCB settings from Supabase: ${error.message}`);
      }

      if (!data) {
        throw new Error(
          'KCB settings not found. Please configure KCB in Settings > Payments.'
        );
      }

      console.log('[v0] KCB settings loaded successfully from Supabase');
      this.supabaseSettings = data as KCBSettings;
      return this.supabaseSettings;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[v0] Failed to load KCB Supabase settings:', errorMsg);
      throw error;
    }
  }

  /**
   * Get the current KCB configuration
   * Must call loadSupabaseSettings() first
   */
  getConfig(): KCBConfig {
    if (!this.supabaseSettings) {
      throw new Error('KCB settings not loaded. Call loadSupabaseSettings() first.');
    }

    if (this.config && this.validated) {
      return this.config;
    }

    const settings = this.supabaseSettings;

    this.config = {
      baseUrl: settings.environment === 'production' 
        ? 'https://api.safaricom.co.ke/api'
        : 'https://sandbox.safaricom.co.ke/api',
      clientId: settings.client_id,
      clientSecret: settings.client_secret,
      routeCode: '207',
      sharedShortcode: true,
      orgShortcode: settings.org_shortcode,
      orgPasskey: settings.org_passkey,
      callbackUrl: settings.callback_url || 'https://jimwas.app/api/kcb/callback',
      publicCertPath: settings.public_cert_path || '',
      tokenCacheTTL: KCB_API_DEFAULTS.TOKEN_CACHE_TTL,
      requestTimeout: KCB_API_DEFAULTS.REQUEST_TIMEOUT,
      maxRetries: KCB_API_DEFAULTS.MAX_RETRIES,
      retryDelay: KCB_API_DEFAULTS.RETRY_DELAY,
    };

    this.validateConfig();
    this.validated = true;

    return this.config;
  }

  /**
   * Validate configuration values
   */
  private validateConfig(): void {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }

    const errors: string[] = [];

    if (!this.config.clientId) {
      errors.push('Client ID is required');
    }

    if (!this.config.clientSecret) {
      errors.push('Client Secret is required');
    }

    if (!this.config.orgShortcode) {
      errors.push('Organization Shortcode is required');
    }

    if (!this.config.orgPasskey) {
      errors.push('Organization Passkey is required');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Check if string is a valid URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if configuration is valid without throwing
   */
  isValid(): boolean {
    try {
      this.getConfig();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset cached configuration (useful for testing)
   */
  reset(): void {
    this.config = null;
    this.validated = false;
  }
}

// Export singleton instance
export const configManager = new ConfigManager();

/**
 * Initialize KCB configuration from Supabase
 * Must be called before using getKCBConfig()
 */
export async function initializeKCBConfig(): Promise<void> {
  try {
    await configManager.loadSupabaseSettings();
  } catch (error) {
    console.error('[v0] Failed to initialize KCB config:', error);
    throw error;
  }
}

/**
 * Convenience function to get config
 * Assumes initializeKCBConfig() has been called
 */
export function getKCBConfig(): KCBConfig {
  return configManager.getConfig();
}

/**
 * Check if KCB is properly configured
 */
export function isKCBConfigured(): boolean {
  try {
    configManager.getConfig();
    return true;
  } catch {
    return false;
  }
}
