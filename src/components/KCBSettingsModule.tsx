import { useState } from 'react';
import {
  Eye, EyeOff, Save, AlertCircle, CheckCircle2, Loader2, Smartphone, Shield,
  Copy, Check, FlaskConical, Zap, ToggleRight, ToggleLeft, RefreshCw
} from 'lucide-react';
import { KCBSettings } from '../lib/settings-types';
import { saveKCBSettings } from '../lib/db';

interface KCBSettingsModuleProps {
  settings: KCBSettings;
  onChange: (settings: KCBSettings) => void;
  onSave: () => void;
  saving: boolean;
  autoSaving: boolean;
  userId?: string;
}

export function KCBSettingsModule({
  settings,
  onChange,
  onSave,
  saving,
  autoSaving,
  userId,
}: KCBSettingsModuleProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    try {
      await onSave();
      showMessage('success', 'KCB STK settings saved successfully');
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to save settings');
    }
  };

  const fillSandboxCredentials = () => {
    onChange({
      ...settings,
      is_enabled: true,
      environment: 'sandbox',
      org_shortcode: 'JIMWAS',
      org_passkey: 'bfb279f9ba9b9d0b3c4e1234567890123456789012345678901234567890',
      default_phone_country_code: '254',
    });
    showMessage('success', 'Sandbox credentials filled. Enter your Client ID and Client Secret from KCB.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Smartphone size={20} />
            KCB STK Push Configuration
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure your KCB M-Pesa STK Push credentials for payment processing
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className={`text-sm ${settings.is_enabled ? 'text-emerald-400' : 'text-slate-400'}`}>
            {settings.is_enabled ? 'Enabled' : 'Disabled'}
          </span>
          <button
            onClick={() => onChange({ ...settings, is_enabled: !settings.is_enabled })}
            className={`p-1 rounded-lg transition ${
              settings.is_enabled
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-600 text-slate-400'
            }`}
          >
            {settings.is_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
          </button>
        </label>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700'
            : 'bg-red-900/30 text-red-400 border border-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Auto-save indicator */}
      {autoSaving && (
        <div className="flex items-center gap-2 p-3 bg-blue-900/20 text-blue-400 rounded-lg border border-blue-700 text-sm">
          <div className="animate-spin">
            <RefreshCw size={16} />
          </div>
          Auto-saving KCB settings...
        </div>
      )}

      {/* Sandbox Testing Banner */}
      {settings.environment === 'sandbox' && (
        <div className="bg-blue-950/60 border border-blue-700 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <FlaskConical size={18} className="text-blue-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-blue-300 font-semibold flex items-center gap-2">
                Sandbox Testing Mode
                <span className="bg-blue-700 text-blue-100 text-xs px-2 py-0.5 rounded-full">UAT</span>
              </h3>
              <p className="text-blue-400/80 text-sm mt-1">
                Testing environment with no real money movement. Use test credentials below.
              </p>
              <div className="mt-2 p-2 bg-blue-900/40 rounded text-xs text-blue-300 font-mono">
                Test Phone: +254 700 000 000 | PIN: any 4 digits
              </div>
            </div>
          </div>
          <button
            onClick={fillSandboxCredentials}
            className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition flex items-center justify-center gap-2"
          >
            <Zap size={16} />
            Fill Sandbox Credentials
          </button>
        </div>
      )}

      {/* Production Warning */}
      {settings.environment === 'production' && (
        <div className="bg-amber-950/60 border border-amber-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-amber-300 font-semibold">Production Environment</h3>
              <p className="text-amber-400/80 text-sm mt-1">
                You are currently in PRODUCTION mode. Real money will be processed with these credentials.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Environment Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Environment</label>
          <select
            value={settings.environment}
            onChange={(e) => onChange({ ...settings, environment: e.target.value as 'sandbox' | 'production' })}
            disabled={saving}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          >
            <option value="sandbox">Sandbox (Testing)</option>
            <option value="production">Production (Live)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Default Country Code</label>
          <select
            value={settings.default_phone_country_code}
            onChange={(e) => onChange({ ...settings, default_phone_country_code: e.target.value })}
            disabled={saving}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          >
            <option value="254">Kenya (+254)</option>
            <option value="256">Uganda (+256)</option>
            <option value="255">Tanzania (+255)</option>
            <option value="250">Rwanda (+250)</option>
          </select>
        </div>
      </div>

      {/* OAuth Credentials */}
      <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={18} className="text-slate-400" />
          <h3 className="text-white font-semibold">OAuth Credentials</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Client ID</label>
          <input
            type="text"
            value={settings.client_id}
            onChange={(e) => onChange({ ...settings, client_id: e.target.value })}
            placeholder="Your KCB Client ID"
            disabled={saving}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50 placeholder-slate-500"
          />
          <p className="text-xs text-slate-400 mt-1">OAuth 2.0 Client ID from KCB Developer Portal</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-300">Client Secret</label>
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="p-1 text-slate-400 hover:text-white transition"
            >
              {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="relative flex items-center">
            <input
              type={showSecret ? 'text' : 'password'}
              value={settings.client_secret}
              onChange={(e) => onChange({ ...settings, client_secret: e.target.value })}
              placeholder="Your KCB Client Secret"
              disabled={saving}
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50 placeholder-slate-500"
            />
            {settings.client_secret && (
              <button
                onClick={() => copyToClipboard(settings.client_secret, 'secret')}
                className="absolute right-3 p-1 text-slate-400 hover:text-white transition"
              >
                {copied === 'secret' ? <Check size={18} /> : <Copy size={18} />}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">OAuth 2.0 Client Secret (never share publicly)</p>
        </div>
      </div>

      {/* M-Pesa Configuration */}
      <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={18} className="text-amber-400" />
          <h3 className="text-white font-semibold">M-Pesa Configuration</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Organization Shortcode</label>
          <input
            type="text"
            value={settings.org_shortcode}
            onChange={(e) => onChange({ ...settings, org_shortcode: e.target.value.toUpperCase() })}
            placeholder="e.g., JIMWAS"
            disabled={saving}
            maxLength={10}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50 placeholder-slate-500 uppercase"
          />
          <p className="text-xs text-slate-400 mt-1">Your M-Pesa merchant shortcode (max 10 characters)</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-300">Organization Passkey</label>
            <button
              onClick={() => setShowPasskey(!showPasskey)}
              className="p-1 text-slate-400 hover:text-white transition"
            >
              {showPasskey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="relative flex items-center">
            <input
              type={showPasskey ? 'text' : 'password'}
              value={settings.org_passkey}
              onChange={(e) => onChange({ ...settings, org_passkey: e.target.value })}
              placeholder="64-character M-Pesa passkey"
              disabled={saving}
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50 placeholder-slate-500 font-mono text-sm"
            />
            {settings.org_passkey && (
              <button
                onClick={() => copyToClipboard(settings.org_passkey, 'passkey')}
                className="absolute right-3 p-1 text-slate-400 hover:text-white transition"
              >
                {copied === 'passkey' ? <Check size={18} /> : <Copy size={18} />}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">64-character M-Pesa passkey for signing requests</p>
        </div>
      </div>

      {/* Callback URLs (Optional) */}
      <details className="bg-slate-700/30 border border-slate-600 rounded-lg">
        <summary className="px-4 py-3 cursor-pointer text-white font-medium hover:bg-slate-700/50 transition">
          Advanced Settings (Optional)
        </summary>
        <div className="p-4 space-y-4 border-t border-slate-600">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Callback URL</label>
            <input
              type="url"
              value={settings.callback_url || ''}
              onChange={(e) => onChange({ ...settings, callback_url: e.target.value })}
              placeholder="https://your-domain.com/api/mpesa/callback"
              disabled={saving}
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50 placeholder-slate-500 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Webhook URL for payment callbacks</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Timeout URL</label>
            <input
              type="url"
              value={settings.timeout_url || ''}
              onChange={(e) => onChange({ ...settings, timeout_url: e.target.value })}
              placeholder="https://your-domain.com/api/mpesa/timeout"
              disabled={saving}
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50 placeholder-slate-500 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Webhook URL for timeout notifications</p>
          </div>
        </div>
      </details>

      {/* Status Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-700/30 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Last Updated</p>
          <p className="text-sm text-white">
            {new Date(settings.updated_at).toLocaleString()}
          </p>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Sync Status</p>
          <p className={`text-sm font-medium ${
            settings.sync_status === 'synced' ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {settings.sync_status === 'synced' ? '✓ Synced' : '⟳ Pending'}
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-slate-700">
        <button
          onClick={handleSave}
          disabled={saving || autoSaving}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving || autoSaving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save KCB Settings
            </>
          )}
        </button>
      </div>

      {/* Quick Reference */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h4 className="text-slate-300 font-semibold text-sm mb-3">Quick Reference</h4>
        <ul className="space-y-2 text-xs text-slate-400">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-1">•</span>
            <span><strong>Client ID/Secret:</strong> Get from KCB Developer Portal OAuth 2.0 Credentials</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-1">•</span>
            <span><strong>Org Shortcode:</strong> Your M-Pesa merchant shortcode (ask KCB support if unsure)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-1">•</span>
            <span><strong>Org Passkey:</strong> 64-character passkey from KCB (keep secure)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-1">•</span>
            <span><strong>Sandbox First:</strong> Always test in sandbox before going production</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
