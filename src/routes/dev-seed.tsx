import { useState } from 'react';
import { seedDatabase } from '../lib/seed-data';

export function DevSeedPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const result = await seedDatabase();
      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-100 mb-8">Database Seed Utility</h1>

        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <p className="text-slate-300 mb-6">
            This utility will populate the database with backup data from jimwas-backup-2026-07-14.json
          </p>

          <button
            onClick={handleSeed}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Seeding...' : 'Seed Database'}
          </button>

          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-red-400 font-semibold">Error:</p>
              <p className="text-red-300 text-sm mt-2">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 p-4 bg-emerald-900/20 border border-emerald-700 rounded-lg">
              <p className="text-emerald-400 font-semibold">Success:</p>
              <div className="text-emerald-300 text-sm mt-2 space-y-1">
                <p>✓ Products seeded: {result.products_seeded}</p>
                <p>✓ Customers seeded: {result.customers_seeded}</p>
                {result.errors.length > 0 && (
                  <div className="mt-2 text-yellow-400">
                    <p>Errors encountered:</p>
                    <ul className="ml-4 list-disc">
                      {result.errors.map((err: string, i: number) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <p className="text-slate-400 text-sm">
            <strong>Note:</strong> This page is for development only. In production, use proper database migration scripts.
          </p>
        </div>
      </div>
    </div>
  );
}
