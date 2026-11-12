'use client';
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
export default function AttendanceScanner() {
  const [sessionToken, setSessionToken] = useState(''); const [uniqueId, setUniqueId] = useState('');
  const [message, setMessage] = useState(''); const [result, setResult] = useState<Record<string,string> | null>(null);
  const [scanning, setScanning] = useState(false); const scanner = useRef<Html5Qrcode | null>(null);
  useEffect(() => { const token = new URLSearchParams(window.location.search).get('session') || ''; setSessionToken(token); return () => { if (scanner.current?.isScanning) scanner.current.stop().catch(() => {}); }; }, []);
  async function startScan() {
    setMessage('');
    try {
      const qr = new Html5Qrcode('sparklab-reader'); scanner.current = qr; setScanning(true);
      await qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, async text => {
        try { const url = new URL(text); const token = url.searchParams.get('session'); if (!token || !url.pathname.endsWith('/attendance')) throw new Error();
          setSessionToken(token); await qr.stop(); setScanning(false); setMessage('QR code verified. Enter your SPARKLAB ID below.');
        } catch { setMessage('This is not a valid SPARKLAB attendance QR code.'); }
      }, () => {});
    } catch { setScanning(false); setMessage('Camera access failed. Allow camera permission and use HTTPS, or open the attendance link provided by SPARKLAB.'); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMessage('Verifying your ID...'); setResult(null);
    try { const response = await fetch('/api/attendance/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionToken, uniqueId }) }); const data = await response.json();
      if (!response.ok) { setMessage(data.error || 'Verification failed.'); return; }
      setResult(data.attendance); setMessage(data.message); setUniqueId('');
    } catch { setMessage('Network error. Please try again.'); }
  }
  return <main className="min-h-screen flex items-center justify-center p-4"><section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl">
    <div className="text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-white text-xl font-bold">S</div><p className="text-xs font-bold tracking-[.2em] text-blue-700">SPARKLAB CREATIVITY & INNOVATION HUB</p><h1 className="mt-2 text-2xl font-bold">Mark your attendance</h1><p className="mt-2 text-sm text-slate-500">Scan the attendance QR code displayed at SPARKLAB, then enter your unique ID.</p></div>
    {!sessionToken && <div className="mt-6"><div id="sparklab-reader" className="overflow-hidden rounded-xl bg-slate-100"/><button onClick={startScan} disabled={scanning} className="mt-3 w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{scanning ? 'CAMERA STARTED — SCAN QR CODE' : 'SCAN QR CODE'}</button></div>}
    {sessionToken && <form onSubmit={submit} className="mt-7 space-y-3"><div className="rounded-xl bg-green-50 p-3 text-sm text-green-800">Attendance session link detected. Enter your short attendance ID.</div><label className="block text-sm font-semibold">Your attendance ID</label><input required maxLength={4} value={uniqueId} onChange={e=>setUniqueId(e.target.value.toUpperCase())} placeholder="e.g. S001 or T001" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"/><button className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white">VERIFY & RECORD ATTENDANCE</button></form>}
    {message && <div role="status" className={`mt-4 rounded-xl p-3 text-sm ${result ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>{message}</div>}
    {result && <div className="mt-4 rounded-2xl border border-green-200 p-4"><h2 className="font-bold text-green-700">ATTENDANCE SUCCESSFUL!</h2>{Object.entries(result).map(([key,value])=><div key={key} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span className="capitalize text-slate-500">{key.replace(/[A-Z]/g, m => ` ${m.toLowerCase()}`)}</span><strong className="text-right">{value}</strong></div>)}</div>}
    <p className="mt-7 text-center text-xs text-slate-400">SPARKLAB • Secure attendance management</p>
  </section></main>;
}
