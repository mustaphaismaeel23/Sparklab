'use client';
import { useEffect, useState } from 'react';

export default function AttendanceScanner() {
  const [sessionToken, setSessionToken] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSessionToken(new URLSearchParams(window.location.search).get('session') || '');
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('Verifying attendance...');
    setResult(null);

    try {
      const payload = {
        ...(sessionToken ? { sessionToken } : {}),
        username: username.trim().toLowerCase()
      };
      const response = await fetch('/api/attendance/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || 'Verification failed.');
        return;
      }

      setResult(data.attendance);
      setMessage(data.message);
      setUsername('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Attendance could not be recorded. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen flex items-center justify-center p-4"><section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl">
    <div className="text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-white text-xl font-bold">S</div><p className="text-xs font-bold tracking-[.2em] text-blue-700">SPARKLAB CREATIVITY & INNOVATION HUB</p><h1 className="mt-2 text-2xl font-bold">Mark your attendance</h1><p className="mt-2 text-sm text-slate-500">Scan the QR code at the attendance table with your phone camera, then enter your username.</p></div>
    <form onSubmit={submit} className="mt-7 space-y-3">
      <label htmlFor="attendance-username" className="block text-sm font-semibold">Your username</label>
      <input id="attendance-username" required minLength={3} maxLength={24} value={username} onChange={event => setUsername(event.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="e.g. amina-yusuf" autoCapitalize="none" autoCorrect="off" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"/>
      <p className="text-xs text-slate-500">Attendance is available while an administrator has an active session. Each person can check in once per day.</p>
      <button disabled={busy} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'VERIFYING...' : 'VERIFY & RECORD ATTENDANCE'}</button>
    </form>
    {message && <div role="status" className={`mt-4 rounded-xl p-3 text-sm ${result ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>{message}</div>}
    {result && <div className="mt-4 rounded-2xl border border-green-200 p-4"><h2 className="font-bold text-green-700">ATTENDANCE SUCCESSFUL!</h2>{Object.entries(result).map(([key, value])=><div key={key} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span className="capitalize text-slate-500">{key.replace(/[A-Z]/g, match => ` ${match.toLowerCase()}`)}</span><strong className="text-right">{value}</strong></div>)}</div>}
    <p className="mt-7 text-center text-xs text-slate-400">SPARKLAB • Secure attendance management</p>
  </section></main>;
}
