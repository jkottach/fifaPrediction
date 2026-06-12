import React, { useState } from 'react';
import { loginWithPin } from '../api';

interface LoginProps {
  onSuccess: (token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Enter your PIN');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { token } = await loginWithPin(pin.trim());
      onSuccess(token);
    } catch {
      setError('Invalid PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="font-display text-xl font-bold text-slate-900 text-center">Admin login</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Enter the admin PIN to manage scores and tournament results.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-pin" className="sr-only">
              PIN
            </label>
            <input
              id="admin-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-lg font-semibold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-center text-sm font-medium text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
