import { useState, useEffect } from 'react';
import { Save, Loader as Loader2, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Smartphone, Eye, EyeOff } from 'lucide-react';
import { getMpesaSettings, saveMpesaSettings } from '../lib/db';
import type { MpesaSettings } from '../lib/types';

export function SettingsPage() {
  const [settings, setSettings] = useState<MpesaSettings | null>(null);
  const [form, setForm] = useState({
    shortcode: '', passkey: '', consumer_key: '', consumer_secret: '',
    callback_url: '', environment: 'sandbox' as 'sandbox' | 'production',
    enabled: false, initiator_name: '', security_credential: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    setLoading(true); setError(null);
    try {
      const data = await getMpesaSettings();
      setSettings(data);
      setForm({ shortcode: data.shortcode, passkey: data.passkey, consumer_key: data.consumer_key, consumer_secret: data.consumer_secret, callback_url: data.callback_url, environment: data.environment, enabled: data.enabled, initiator_name: data.initiator_name, security_credential: data.security_credential });
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load settings.'); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(false);
    try {
      const updated = await saveMpesaSettings({ shortcode: form.shortcode, passkey: form.passkey, consumer_key: form.consumer_key, consumer_secret: form.consumer_secret, callback_url: form.callback_url, environment: form.environment, enabled: form.enabled, initiator_name: form.initiator_name, security_credential: form.security_credential });
      setSettings(updated); setSuccess(true); setTimeout(() => setSuccess(false), 4000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save settings.'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-slate-400" size={24} /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Settings</h1><p className="text-slate-400 text-sm mt-1">KCB BUNI M-Pesa Express API — STK Push configuration</p></div>
      {success && <div className="rounded-lg bg-emerald-900/30 border border-emerald-800 p-4 text-emerald-300 flex items-center gap-2"><CheckCircle size={18} /> Settings saved successfully. They will persist across app restarts.</div>}
      {error && <div className="rounded-lg bg-red-900/30 border border-red-800 p-4 text-red-300 flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${form.enabled ? 'bg-emerald-600' : 'bg-slate-700'}`}><Smartphone className="text-white" size={20} /></div>
            <div><p className="text-white font-medium text-sm">M-Pesa STK Push</p><p className="text-xs text-slate-500">Enable to accept M-Pesa payments at checkout</p></div>
          </div>
          <button onClick={() => setForm((prev) => ({ ...prev, enabled: !prev.enabled }))} className={`relative w-12 h-6 rounded-full transition ${form.enabled ? 'bg-emerald-600' : 'bg-slate-600'}`}><span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.enabled ? 'translate-x-6' : ''}`} /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Business Shortcode" value={form.shortcode} onChange={(v) => setForm({ ...form, shortcode: v })} placeholder="e.g. 174379" />
          <Field label="Environment" value={form.environment} onChange={(v) => setForm({ ...form, environment: v as 'sandbox' | 'production' })} type="select" options={[{ value: 'sandbox', label: 'Sandbox' }, { value: 'production', label: 'Production' }]} />
        </div>
        <Field label="Passkey" value={form.passkey} onChange={(v) => setForm({ ...form, passkey: v })} placeholder="M-Pesa passkey" type={showSecrets ? 'text' : 'password'} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Consumer Key" value={form.consumer_key} onChange={(v) => setForm({ ...form, consumer_key: v })} placeholder="KCB BUNI consumer key" type={showSecrets ? 'text' : 'password'} />
          <Field label="Consumer Secret" value={form.consumer_secret} onChange={(v) => setForm({ ...form, consumer_secret: v })} placeholder="KCB BUNI consumer secret" type={showSecrets ? 'text' : 'password'} />
        </div>
        <Field label="Callback URL" value={form.callback_url} onChange={(v) => setForm({ ...form, callback_url: v })} placeholder="https://yourdomain.com/api/mpesa/callback" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Initiator Name" value={form.initiator_name} onChange={(v) => setForm({ ...form, initiator_name: v })} placeholder="e.g. apiuser" />
          <Field label="Security Credential" value={form.security_credential} onChange={(v) => setForm({ ...form, security_credential: v })} placeholder="Encrypted credential" type={showSecrets ? 'text' : 'password'} />
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          <button onClick={() => setShowSecrets(!showSecrets)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">{showSecrets ? <EyeOff size={16} /> : <Eye size={16} />}{showSecrets ? 'Hide secrets' : 'Show secrets'}</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Settings</button>
        </div>
      </div>
      {settings && <div className="text-xs text-slate-500">Last updated: {new Date(settings.updated_at).toLocaleString()}</div>}
    </div>
  );
}

interface FieldProps { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: 'text' | 'password' | 'select'; options?: { value: string; label: string }[]; }
function Field({ label, value, onChange, placeholder, type = 'text', options }: FieldProps) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
      {type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">{options?.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select>
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
      )}
    </div>
  );
}
