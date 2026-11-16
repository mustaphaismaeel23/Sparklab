'use client';
import { useEffect, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';

type AttendanceResult = Record<string, string>;
type CheckinCategory = 'STUDENT' | 'STAFF' | 'VISITOR' | 'GUEST' | 'SUBSCRIBER';
type VisitorHost = { id: string; fullName: string; category: CheckinCategory };
type CheckinMode = 'choose' | 'member' | 'visitor';
const categoryLabels: Record<CheckinCategory, string> = {
  STUDENT: 'Student',
  STAFF: 'Staff',
  VISITOR: 'Visitor',
  GUEST: 'Guest',
  SUBSCRIBER: 'Subscriber'
};

function VisitorCheckinForm({ sessionToken, onBack }: { sessionToken: string; onBack: () => void }) {
  const [visitorName, setVisitorName] = useState('');
  const [hostSelection, setHostSelection] = useState('');
  const [otherHostName, setOtherHostName] = useState('');
  const [hosts, setHosts] = useState<VisitorHost[]>([]);
  const [hostsError, setHostsError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<AttendanceResult | null>(null);

  useEffect(() => {
    let active = true;
    setHostsError('');
    fetch('/api/visitor-hosts', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load hosts.');
        if (active) setHosts(data.hosts);
      })
      .catch(error => {
        if (active) setHostsError(error instanceof Error ? error.message : 'Could not load the host list.');
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('Recording visitor check-in...');
    setResult(null);

    try {
      const payload = {
        ...(sessionToken ? { sessionToken } : {}),
        visitorName: visitorName.trim(),
        ...(hostSelection === 'other' ? { otherHostName: otherHostName.trim() } : { hostPersonId: hostSelection })
      };
      let response: Response;
      try {
        response = await fetch('/api/visitor-visits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch {
        setMessage('The connection was interrupted. Your visit may have been recorded; ask an administrator to confirm before retrying.');
        return;
      }

      let data: { error?: string; message?: string; visit?: AttendanceResult };
      try {
        data = await response.json();
      } catch {
        setMessage('The server response was interrupted. Your visit may have been recorded; ask an administrator to confirm before retrying.');
        return;
      }
      if (!response.ok) {
        setMessage(data.error || 'Visitor check-in failed.');
        return;
      }
      if (!data.message || !data.visit) {
        setMessage('The server response was incomplete. Ask an administrator to confirm your visit.');
        return;
      }

      setResult(data.visit);
      setMessage(data.message);
      setVisitorName('');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <form onSubmit={submit} className="mt-7 space-y-3">
      <label htmlFor="visitor-name" className="block text-sm font-semibold">Your full name</label>
      <input id="visitor-name" required minLength={2} maxLength={120} value={visitorName} onChange={event => setVisitorName(event.target.value)} autoComplete="name" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-gold"/>
      <label htmlFor="visitor-host" className="block text-sm font-semibold">Who are you visiting?</label>
      <select id="visitor-host" required value={hostSelection} onChange={event => setHostSelection(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3">
        <option value="">Select a host</option>
        {hosts.map(host => <option key={host.id} value={host.id}>{host.fullName} ({categoryLabels[host.category]})</option>)}
        <option value="other">Other (not listed)</option>
      </select>
      {hostSelection === 'other' && <label htmlFor="other-host-name" className="block text-sm font-semibold">Name of the person you are visiting<input id="other-host-name" required minLength={2} maxLength={120} value={otherHostName} onChange={event => setOtherHostName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-gold"/></label>}
      {hostsError && <p role="alert" className="text-sm text-amber-800">{hostsError} <button type="button" onClick={() => setLoadAttempt(value => value + 1)} className="font-semibold underline">Retry</button></p>}
      <p className="text-xs text-slate-500">A visitor can check in once per day. No account or location permission is needed.</p>
      <button disabled={busy} className="w-full rounded-xl bg-brand-navy px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'RECORDING...' : 'RECORD VISITOR CHECK-IN'}</button>
      <button type="button" onClick={onBack} className="w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold">Back</button>
    </form>
    {message && <div role="status" className={`mt-4 rounded-xl p-3 text-sm ${result ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>{message}</div>}
    {result && <div className="mt-4 rounded-2xl border border-green-200 p-4"><h2 className="font-bold text-green-700">VISITOR CHECK-IN RECORDED!</h2>{Object.entries(result).map(([key, value]) => <div key={key} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span className="capitalize text-slate-500">{key.replace(/[A-Z]/g, match => ` ${match.toLowerCase()}`)}</span><strong className="text-right">{value}</strong></div>)}</div>}
  </>;
}

export default function AttendanceScanner() {
  const [sessionToken, setSessionToken] = useState('');
  const [mode, setMode] = useState<CheckinMode>('choose');
  const [username, setUsername] = useState('');
  const [checkinCategory, setCheckinCategory] = useState<CheckinCategory>('STUDENT');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSessionToken(new URLSearchParams(window.location.search).get('session') || '');
  }, []);

  async function submitAttendance(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('Verifying attendance...');
    setResult(null);

    try {
      const payload = {
        ...(sessionToken ? { sessionToken } : {}),
        username: username.trim().toLowerCase(),
        category: checkinCategory
      };
      let response: Response;
      try {
        response = await fetch('/api/attendance/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch {
        setMessage('The connection was interrupted. Your check-in may have been recorded; ask an administrator to confirm before retrying.');
        return;
      }

      let data: { error?: string; message?: string; attendance?: AttendanceResult };
      try {
        data = await response.json();
      } catch {
        setMessage('The server response was interrupted. Your check-in may have been recorded; ask an administrator to confirm before retrying.');
        return;
      }
      if (!response.ok) {
        setMessage(data.error || 'Verification failed.');
        return;
      }
      if (!data.message || !data.attendance) {
        setMessage('The server response was incomplete. Your check-in may have been recorded; ask an administrator to confirm.');
        return;
      }

      setResult(data.attendance);
      setMessage(data.message);
      setUsername('');
    } finally {
      setBusy(false);
    }
  }

  function chooseMode(nextMode: CheckinMode) {
    setMode(nextMode);
    setMessage('');
    setResult(null);
  }

  return <main className="flex min-h-screen items-center justify-center bg-brand-gold-soft p-4"><section className="w-full max-w-md rounded-3xl border-2 border-brand-gold bg-white p-7 shadow-xl">
    <div className="text-center"><BrandLogo priority className="mx-auto mb-2 h-28 w-[154px] object-contain"/><p className="text-[11px] font-bold tracking-[.1em] text-brand-navy">SPARKLAB CREATIVITY AND INNOVATION HUB</p><h1 className="mt-2 text-2xl font-bold">Mark your attendance</h1><p className="mt-2 text-sm text-slate-500">{mode === 'choose' ? 'Choose the option that matches your visit.' : mode === 'visitor' ? 'Enter your name and who you are visiting.' : 'Choose your category and enter your registered username.'}</p></div>
    {mode === 'choose' && <div className="mt-7 space-y-3"><button onClick={() => chooseMode('member')} className="w-full rounded-xl bg-brand-navy px-4 py-3 font-semibold text-white">Registered user check-in (all five categories)</button><button onClick={() => chooseMode('visitor')} className="w-full rounded-xl border-2 border-brand-gold bg-brand-gold-soft px-4 py-3 font-semibold text-brand-navy">Visitor check-in without an account</button></div>}
    {mode === 'member' && <form onSubmit={submitAttendance} className="mt-7 space-y-3">
      <label htmlFor="attendance-category" className="block text-sm font-semibold">Your category</label>
      <select id="attendance-category" required value={checkinCategory} onChange={event => setCheckinCategory(event.target.value as CheckinCategory)} className="w-full rounded-xl border border-slate-300 px-4 py-3">
        {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label htmlFor="attendance-username" className="block text-sm font-semibold">Your username</label>
      <input id="attendance-username" required minLength={3} maxLength={24} value={username} onChange={event => setUsername(event.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="e.g. amina-yusuf" autoCapitalize="none" autoCorrect="off" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-gold"/>
      <p className="text-xs text-slate-500">Attendance is available while an administrator has an active session. Each person can check in once per day. Subscribers must have an active pass.</p>
      <button disabled={busy} className="w-full rounded-xl bg-brand-navy px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'VERIFYING...' : 'VERIFY & RECORD ATTENDANCE'}</button>
      <button type="button" onClick={() => chooseMode('choose')} className="w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold">Back</button>
    </form>}
    {mode === 'visitor' && <VisitorCheckinForm sessionToken={sessionToken} onBack={() => chooseMode('choose')}/>}
    {mode === 'member' && message && <div role="status" className={`mt-4 rounded-xl p-3 text-sm ${result ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>{message}</div>}
    {mode === 'member' && result && <div className="mt-4 rounded-2xl border border-green-200 p-4"><h2 className="font-bold text-green-700">ATTENDANCE SUCCESSFUL!</h2>{Object.entries(result).map(([key, value]) => <div key={key} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span className="capitalize text-slate-500">{key.replace(/[A-Z]/g, match => ` ${match.toLowerCase()}`)}</span><strong className="text-right">{value}</strong></div>)}</div>}
    <p className="mt-7 text-center text-xs text-slate-400">SPARKLAB • Secure attendance management</p>
  </section></main>;
}
