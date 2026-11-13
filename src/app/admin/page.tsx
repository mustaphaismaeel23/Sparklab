'use client';
import { useEffect, useMemo, useState } from 'react';

type Person = { id: string; username: string | null; fullName: string; phone: string; email: string | null; category: 'STUDENT' | 'STAFF'; department: string; active: boolean; registeredAt: string; daysAttended: number };
type RecordRow = { id: string; name: string; username: string; category: string; department: string; date: string; time: string; daysAttended: number; status: string; session: string };
type Session = { id: string; title: string; endsAt: string | null };
type Tab = 'overview' | 'people' | 'attendance' | 'session';
const button = 'rounded-xl px-4 py-2 text-sm font-semibold';

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('session');
  const [admin, setAdmin] = useState<{ name: string; email: string } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('ALL');
  const [date, setDate] = useState('');
  const [form, setForm] = useState({ fullName: '', username: '', phone: '', email: '', category: 'STUDENT', department: '' });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceRefresh, setAttendanceRefresh] = useState(0);
  const [qr, setQr] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [sessionTitle, setSessionTitle] = useState('SPARKLAB Attendance');

  async function load() {
    const auth = await fetch('/api/auth/me');
    if (!auth.ok) {
      window.location.href = '/admin/login';
      return;
    }
    const authData = await auth.json();
    setAdmin(authData.admin);
    const [peopleResponse, recordsResponse, sessionResponse] = await Promise.all([
      fetch('/api/people'),
      fetch('/api/attendance'),
      fetch('/api/sessions/active')
    ]);
    if (peopleResponse.ok) setPeople((await peopleResponse.json()).people);
    if (recordsResponse.ok) setRecords((await recordsResponse.json()).records);
    if (sessionResponse.ok) {
      const data = await sessionResponse.json();
      setSession(data.session);
      setQr(data.qrDataUrl);
    }
  }

  useEffect(() => {
    load().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (tab !== 'attendance') return;
    let active = true;
    let loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch('/api/attendance', { cache: 'no-store' });
        if (!response.ok) throw new Error('Attendance refresh failed.');
        const data = await response.json();
        if (active) {
          setRecords(data.records);
          setAttendanceError('');
        }
      } catch {
        if (active) setAttendanceError('Could not refresh attendance records. Try again.');
      } finally {
        loading = false;
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 10_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [tab, attendanceRefresh]);

  const students = people.filter(person => person.category === 'STUDENT').length;
  const staff = people.filter(person => person.category === 'STAFF').length;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  const todayRecords = records.filter(record => record.date === today);
  const presentUsernames = new Set(todayRecords.map(record => record.username));
  const absentToday = people.filter(person => person.active && !presentUsernames.has(person.username ?? '')).length;
  const visiblePeople = useMemo(() => people.filter(person =>
    (category === 'ALL' || person.category === category) &&
    (!q || person.fullName.toLowerCase().includes(q.toLowerCase()) || (person.username ?? '').toLowerCase().includes(q.toLowerCase()))
  ), [people, q, category]);
  const visibleRecords = useMemo(() => records.filter(record =>
    (!date || record.date === date) &&
    (category === 'ALL' || record.category === category) &&
    (!q || record.name.toLowerCase().includes(q.toLowerCase()) || record.username.toLowerCase().includes(q.toLowerCase()))
  ), [records, date, category, q]);

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(`Registered ${data.person.fullName}. Username: ${data.person.username}`);
      setForm({ fullName: '', username: '', phone: '', email: '', category: 'STUDENT', department: '' });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  }

  async function updatePerson(person: Person, active = person.active) {
    const response = await fetch(`/api/people/${person.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: person.fullName,
        username: person.username,
        phone: person.phone,
        email: person.email || '',
        department: person.department,
        active
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error || 'Could not update user details.');
      return;
    }
    setNotice(active === person.active ? 'User details updated.' : `User ${active ? 'activated' : 'deactivated'}.`);
    await load();
  }

  async function editPerson(person: Person) {
    const fullName = window.prompt('Full name', person.fullName);
    if (fullName === null) return;
    const username = window.prompt('Username', person.username ?? '');
    if (username === null) return;
    const phone = window.prompt('Phone number', person.phone);
    if (phone === null) return;
    const department = window.prompt('Department / Programme', person.department);
    if (department === null) return;
    const email = window.prompt('Email (optional)', person.email || '');
    if (email === null) return;
    await updatePerson({ ...person, fullName, username, phone, department, email });
  }

  async function deletePerson(person: Person) {
    if (!window.confirm(`Delete ${person.fullName} and all ${person.daysAttended} attendance days? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/people/${person.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(`Deleted ${person.fullName} and their attendance history.`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete the user.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAttendance(record: RecordRow) {
    if (!window.confirm(`Delete ${record.name}'s attendance record for ${record.date}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/attendance/${record.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice('Attendance record deleted.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete the attendance record.');
    } finally {
      setBusy(false);
    }
  }

  async function createSession() {
    setBusy(true);
    setNotice('Starting attendance session...');
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sessionTitle,
          durationMinutes: duration
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSession(data.session);
      setQr(data.qrDataUrl);
      setNotice('Attendance session created. Display this QR code for participants.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create session.');
    } finally {
      setBusy(false);
    }
  }

  async function exportReport(format: 'xlsx' | 'pdf') {
    const response = await fetch(`/api/reports/export?format=${format}`);
    if (!response.ok) {
      setNotice('Report export failed.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sparklab-attendance.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  if (!ready) return <div className="p-10 text-center">Loading SPARKLAB dashboard...</div>;

  return <main className="min-h-screen">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 font-bold text-white">S</div><div><p className="font-bold">SPARKLAB</p><p className="text-xs text-slate-500">Attendance Management</p></div></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:block">{admin?.name}</span><button onClick={logout} className={`${button} border border-slate-200`}>Sign out</button></div></div></header>
    <div className="mx-auto max-w-7xl px-5 py-7">
      <div className="mb-6"><p className="text-sm font-semibold text-blue-700">ADMINISTRATION</p><h1 className="text-3xl font-bold">Dashboard</h1><p className="mt-1 text-sm text-slate-500">Manage registrations and attendance records.</p></div>
      <nav className="mb-6 flex flex-wrap gap-2">{(['overview', 'people', 'attendance', 'session'] as Tab[]).map(tabName => <button key={tabName} onClick={() => { setTab(tabName); setNotice(''); }} className={`${button} capitalize ${tab === tabName ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white'}`}>{tabName === 'people' ? 'Users' : tabName === 'session' ? 'QR Session' : tabName}</button>)}</nav>
      {notice && <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">{notice}</div>}
      {tab === 'overview' && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[{ label: 'Registered students', value: students }, { label: 'Registered staff', value: staff }, { label: "Today's attendance", value: todayRecords.length }, { label: 'Present today', value: presentUsernames.size }, { label: 'Absent today', value: absentToday }].map(item => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-bold">{item.value}</p></div>)}</div>
        <div className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Quick actions</h2><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setTab('people')} className={`${button} bg-blue-700 text-white`}>Register a user</button><button onClick={() => setTab('session')} className={`${button} border`}>Create attendance QR</button><button onClick={() => setTab('attendance')} className={`${button} border`}>View attendance</button></div></div><div className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Today's attendance</h2><p className="mt-2 text-3xl font-bold">{todayRecords.length}</p><p className="text-sm text-slate-500">Attendance entries recorded today (Africa/Lagos).</p></div></div>
      </>}
      {tab === 'people' && <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form onSubmit={register} className="h-fit rounded-2xl border bg-white p-5">
          <h2 className="mb-4 font-bold">Register student or staff</h2>
          {([['fullName', 'Full name'], ['username', 'Username'], ['phone', 'Phone number'], ['email', 'Email (optional)'], ['department', 'Department / Programme']] as const).map(([key, label]) => <label key={key} className="mb-3 block text-sm font-medium">{label}<input required={key !== 'email'} maxLength={key === 'username' ? 24 : undefined} value={form[key]} onChange={event => setForm({ ...form, [key]: key === 'username' ? event.target.value.toLowerCase().replace(/\s+/g, '-') : event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2"/>{key === 'username' && <span className="text-xs text-slate-500">3–24 letters, numbers, or hyphens; must be unique.</span>}</label>)}
          <label className="mb-4 block text-sm font-medium">Category<select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="STUDENT">Student</option><option value="STAFF">Staff</option></select></label>
          <button disabled={busy} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white">{busy ? 'Saving...' : 'Register user'}</button>
        </form>
        <div className="rounded-2xl border bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Registered users ({visiblePeople.length})</h2><input value={q} onChange={event => setQ(event.target.value)} placeholder="Search name or username" className="rounded-xl border px-3 py-2 text-sm"/></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>{['Name / Username', 'Category', 'Department', 'Days attended', 'Status', 'Action'].map(heading => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
            <tbody>{visiblePeople.map(person => <tr key={person.id} className="border-t">
              <td className="p-3"><b>{person.fullName}</b><div className="text-xs text-slate-500">@{person.username || 'pending backfill'}</div></td>
              <td className="p-3">{person.category}</td>
              <td className="p-3">{person.department}</td>
              <td className="p-3">{person.daysAttended}</td>
              <td className="p-3">{person.active ? 'Active' : 'Inactive'}</td>
              <td className="p-3"><div className="flex flex-wrap gap-2">
                <button onClick={() => void editPerson(person)} className="text-blue-700 underline">Edit</button>
                <button onClick={() => void updatePerson(person, !person.active)} className="text-blue-700 underline">{person.active ? 'Deactivate' : 'Activate'}</button>
                <button disabled={busy} onClick={() => void deletePerson(person)} className="text-red-700 underline disabled:opacity-50">Delete</button>
              </div></td>
            </tr>)}</tbody>
          </table></div>
        </div>
      </div>}
      {tab === 'attendance' && <div className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Attendance records ({visibleRecords.length})</h2><div className="flex flex-wrap gap-2"><button onClick={() => setAttendanceRefresh(value => value + 1)} className={`${button} border`}>Refresh</button><input type="date" value={date} onChange={event => setDate(event.target.value)} className="rounded-xl border px-3 py-2 text-sm"/><input value={q} onChange={event => setQ(event.target.value)} placeholder="Search name or username" className="rounded-xl border px-3 py-2 text-sm"/><select value={category} onChange={event => setCategory(event.target.value)} className="rounded-xl border px-3 py-2 text-sm"><option value="ALL">All categories</option><option value="STUDENT">Students</option><option value="STAFF">Staff</option></select></div></div>
        {attendanceError && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{attendanceError}</p>}
        <div className="mb-4 flex gap-2"><button onClick={() => void exportReport('xlsx')} className={`${button} bg-green-700 text-white`}>Export Excel</button><button onClick={() => void exportReport('pdf')} className={`${button} bg-slate-800 text-white`}>Export PDF</button></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr>{['Name / Username', 'Category', 'Department', 'Date', 'Time', 'Days attended', 'Status', 'Action'].map(heading => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
          <tbody>{visibleRecords.map(record => <tr key={record.id} className="border-t">
            <td className="p-3"><b>{record.name}</b><div className="text-xs text-slate-500">@{record.username || 'pending backfill'}</div></td>
            <td className="p-3">{record.category}</td>
            <td className="p-3">{record.department}</td>
            <td className="p-3">{record.date}</td>
            <td className="p-3">{record.time}</td>
            <td className="p-3">{record.daysAttended}</td>
            <td className="p-3"><span className="rounded-full bg-green-50 px-2 py-1 text-green-700">{record.status}</span></td>
            <td className="p-3"><button disabled={busy} onClick={() => void deleteAttendance(record)} className="text-red-700 underline disabled:opacity-50">Delete</button></td>
          </tr>)}</tbody>
        </table>{visibleRecords.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No attendance records found.</p>}</div>
      </div>}
      {tab === 'session' && <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5">
          <h2 className="font-bold">Create attendance session</h2>
          <p className="mt-1 text-sm text-slate-500">Start a session to enable check-in. The printed QR stays the same; a no-limit session remains active until you start another session.</p>
          <label className="mt-4 block text-sm font-medium">Session title<input value={sessionTitle} onChange={event => setSessionTitle(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
          <label className="mt-4 block text-sm font-medium">Session duration
            <select value={duration ?? 'unlimited'} onChange={event => setDuration(event.target.value === 'unlimited' ? null : Number(event.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="unlimited">No time limit (default)</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={240}>4 hours</option>
              <option value={480}>8 hours</option>
            </select>
          </label>
          <button disabled={busy} onClick={() => void createSession()} className="mt-5 w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white">{busy ? 'Creating...' : 'Start attendance session'}</button>
          {session ? <p className="mt-4 text-sm text-slate-600">Active session: <b>{session.title}</b>{session.endsAt ? <><br/>Expires: {new Date(session.endsAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</> : <><br/>No expiration. Each person can check in once per day.</>}</p> : <p className="mt-4 text-sm text-amber-700">No active session. Start one before participants check in.</p>}
        </div>
        <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border bg-white p-5 text-center">{qr ? <><h2 className="font-bold">Reusable attendance QR code</h2><img src={qr} alt="Reusable SPARKLAB attendance QR code" className="mt-3 w-72 max-w-full"/><p className="mt-2 text-sm text-slate-500">Print this code once and keep it at the attendance table.</p><a href={qr} download="sparklab-attendance-qr.png" className="mt-3 text-sm font-semibold text-blue-700 underline">Download QR to print</a></> : <><div className="text-5xl">▦</div><p className="mt-3 font-semibold">QR code is loading</p></>}</div>
      </div>}
    </div>
  </main>;
}
