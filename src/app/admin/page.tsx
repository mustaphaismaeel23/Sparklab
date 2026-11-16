'use client';
import { useEffect, useMemo, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';

type UserCategory = 'STUDENT' | 'STAFF' | 'VISITOR' | 'GUEST' | 'SUBSCRIBER';
type SubscriptionPlan = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type Person = { id: string; username: string | null; fullName: string; phone: string; email: string | null; category: UserCategory; department: string; subscriptionPlan: SubscriptionPlan | null; subscriptionStartDate: string | null; subscriptionExpiryDate: string | null; active: boolean; registeredAt: string; daysAttended: number };
type RecordRow = { id: string; name: string; username: string; category: UserCategory; department: string; subscriptionPlan: SubscriptionPlan | null; subscriptionStartDate: string; subscriptionExpiryDate: string; date: string; time: string; daysAttended: number; status: string; session: string };
type VisitorRecord = { id: string; visitorName: string; hostName: string; date: string; time: string; session: string };
type Session = { id: string; title: string; endsAt: string | null };
type Tab = 'overview' | 'people' | 'attendance' | 'visitors' | 'session';
const button = 'rounded-xl px-4 py-2 text-sm font-semibold';
const categoryLabels: Record<UserCategory, string> = {
  STUDENT: 'Student',
  STAFF: 'Staff',
  VISITOR: 'Visitor',
  GUEST: 'Guest',
  SUBSCRIBER: 'Subscriber'
};
const categoryPluralLabels: Record<UserCategory, string> = {
  STUDENT: 'Students',
  STAFF: 'Staff',
  VISITOR: 'Visitors',
  GUEST: 'Guests',
  SUBSCRIBER: 'Subscribers'
};
const categoryDescriptions: Record<UserCategory, string> = {
  STUDENT: "Individuals enrolled in the hub's learning programmes.",
  STAFF: 'Employees and team members working at the hub.',
  VISITOR: 'Individuals visiting for meetings, enquiries, or other temporary engagements.',
  GUEST: 'Invited individuals or people visiting for a specific purpose.',
  SUBSCRIBER: "Individuals paying to use the hub's workspace for a specific duration."
};
const subscriptionPlanLabels: Record<SubscriptionPlan, string> = {
  DAILY: 'Daily Pass',
  WEEKLY: 'Weekly Pass',
  MONTHLY: 'Monthly Pass'
};

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('session');
  const [admin, setAdmin] = useState<{ name: string; email: string } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [visitorRecords, setVisitorRecords] = useState<VisitorRecord[]>([]);
  const [q, setQ] = useState('');
  const [visitorQuery, setVisitorQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [date, setDate] = useState('');
  const [visitorDate, setVisitorDate] = useState('');
  const [form, setForm] = useState({ fullName: '', username: '', phone: '', email: '', category: 'STUDENT' as UserCategory, department: '', subscriptionPlan: 'DAILY' as SubscriptionPlan, subscriptionStartDate: '', subscriptionExpiryDate: '' });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceRefresh, setAttendanceRefresh] = useState(0);
  const [visitorError, setVisitorError] = useState('');
  const [visitorRefresh, setVisitorRefresh] = useState(0);
  const [qr, setQr] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [sessionTitle, setSessionTitle] = useState('SPARKLAB CREATIVITY AND INNOVATION HUB Attendance');

  async function load() {
    const auth = await fetch('/api/auth/me');
    if (!auth.ok) {
      window.location.href = '/admin/login';
      return;
    }
    const authData = await auth.json();
    setAdmin(authData.admin);
    const [peopleResponse, recordsResponse, visitorResponse, sessionResponse] = await Promise.all([
      fetch('/api/people'),
      fetch('/api/attendance'),
      fetch('/api/visitor-visits'),
      fetch('/api/sessions/active')
    ]);
    if (peopleResponse.ok) setPeople((await peopleResponse.json()).people);
    if (recordsResponse.ok) setRecords((await recordsResponse.json()).records);
    if (visitorResponse.ok) setVisitorRecords((await visitorResponse.json()).visits);
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
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    void refresh();
    const interval = window.setInterval(refresh, 10_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [tab, attendanceRefresh]);

  useEffect(() => {
    if (tab !== 'visitors') return;
    let active = true;
    let loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch('/api/visitor-visits', { cache: 'no-store' });
        if (!response.ok) throw new Error('Visitor refresh failed.');
        const data = await response.json();
        if (active) {
          setVisitorRecords(data.visits);
          setVisitorError('');
        }
      } catch {
        if (active) setVisitorError('Could not refresh visitor records. Try again.');
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
  }, [tab, visitorRefresh]);

  const registeredCounts = Object.fromEntries(
    (Object.keys(categoryLabels) as UserCategory[]).map(userCategory => [
      userCategory,
      people.filter(person => person.category === userCategory).length
    ])
  ) as Record<UserCategory, number>;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  const todayRecords = records.filter(record => record.date === today);
  const todayVisitorRecords = visitorRecords.filter(record => record.date === today);
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
  const visibleVisitorRecords = useMemo(() => visitorRecords.filter(record =>
    (!visitorDate || record.date === visitorDate) &&
    (!visitorQuery || record.visitorName.toLowerCase().includes(visitorQuery.toLowerCase()) || record.hostName.toLowerCase().includes(visitorQuery.toLowerCase()))
  ), [visitorRecords, visitorDate, visitorQuery]);

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ...(form.category === 'SUBSCRIBER'
            ? {}
            : { subscriptionPlan: undefined, subscriptionStartDate: undefined, subscriptionExpiryDate: undefined })
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(`Registered ${data.person.fullName}. Username: ${data.person.username}`);
      setForm({ fullName: '', username: '', phone: '', email: '', category: 'STUDENT', department: '', subscriptionPlan: 'DAILY', subscriptionStartDate: '', subscriptionExpiryDate: '' });
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
        active,
        ...(person.category === 'SUBSCRIBER' && person.subscriptionPlan && person.subscriptionStartDate && person.subscriptionExpiryDate
          ? {
              subscriptionPlan: person.subscriptionPlan,
              subscriptionStartDate: person.subscriptionStartDate.slice(0, 10),
              subscriptionExpiryDate: person.subscriptionExpiryDate.slice(0, 10)
            }
          : {})
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
    let updatedPerson = { ...person, fullName, username, phone, department, email };
    if (person.category === 'SUBSCRIBER') {
      const plan = window.prompt('Plan (DAILY, WEEKLY, or MONTHLY)', person.subscriptionPlan ?? 'DAILY');
      if (plan === null) return;
      if (plan !== 'DAILY' && plan !== 'WEEKLY' && plan !== 'MONTHLY') {
        setNotice('Choose DAILY, WEEKLY, or MONTHLY for the subscription plan.');
        return;
      }
      const subscriptionStartDate = window.prompt('Subscription start date (YYYY-MM-DD)', person.subscriptionStartDate?.slice(0, 10) ?? '');
      if (subscriptionStartDate === null) return;
      const subscriptionExpiryDate = window.prompt('Subscription expiry date (YYYY-MM-DD)', person.subscriptionExpiryDate?.slice(0, 10) ?? '');
      if (subscriptionExpiryDate === null) return;
      updatedPerson = {
        ...updatedPerson,
        subscriptionPlan: plan,
        subscriptionStartDate,
        subscriptionExpiryDate
      };
    }
    await updatePerson(updatedPerson);
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

  async function deleteVisitorRecord(record: VisitorRecord) {
    if (!window.confirm(`Delete ${record.visitorName}'s visitor check-in for ${record.date}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/visitor-visits/${record.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice('Visitor record deleted.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete the visitor record.');
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

  if (!ready) return <div className="p-10 text-center text-brand-navy">Loading SPARKLAB dashboard...</div>;

  return <main className="min-h-screen">
    <header className="border-b-4 border-brand-gold bg-white shadow-sm"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-2"><BrandLogo priority className="h-16 w-[88px] object-contain sm:h-[72px] sm:w-[98px]"/><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:block">{admin?.name}</span><button onClick={logout} className={`${button} border border-slate-200`}>Sign out</button></div></div></header>
    <div className="mx-auto max-w-7xl px-5 py-7">
      <div className="mb-6"><p className="text-sm font-semibold tracking-wide text-brand-navy">ADMINISTRATION</p><h1 className="text-3xl font-bold">Dashboard</h1><p className="mt-1 text-sm text-slate-500">Manage registrations and attendance records.</p></div>
      <nav className="mb-6 flex flex-wrap gap-2">{(['overview', 'people', 'attendance', 'visitors', 'session'] as Tab[]).map(tabName => <button key={tabName} onClick={() => { setTab(tabName); setNotice(''); }} className={`${button} capitalize ${tab === tabName ? 'bg-brand-navy text-white' : 'border border-slate-200 bg-white'}`}>{tabName === 'people' ? 'Users' : tabName === 'session' ? 'QR Session' : tabName}</button>)}</nav>
      {notice && <div className="mb-5 rounded-xl border border-brand-gold bg-brand-gold-soft p-3 text-sm text-brand-navy-dark">{notice}</div>}
      {tab === 'overview' && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{[
          { label: 'Registered students', value: registeredCounts.STUDENT },
          { label: 'Registered staff', value: registeredCounts.STAFF },
          { label: 'Registered visitors', value: registeredCounts.VISITOR },
          { label: 'Registered guests', value: registeredCounts.GUEST },
          { label: 'Registered subscribers', value: registeredCounts.SUBSCRIBER },
          { label: "Today's registered attendance", value: todayRecords.length },
          { label: 'Walk-in visitors today', value: todayVisitorRecords.length },
          { label: 'Present registered people', value: presentUsernames.size },
          { label: 'Absent registered people', value: absentToday }
        ].map(item => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-bold">{item.value}</p></div>)}</div>
        <div className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Quick actions</h2><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setTab('people')} className={`${button} bg-brand-navy text-white`}>Register a user</button><button onClick={() => setTab('session')} className={`${button} border border-brand-gold`}>Create attendance QR</button><button onClick={() => setTab('attendance')} className={`${button} border border-brand-gold`}>View attendance</button><button onClick={() => setTab('visitors')} className={`${button} border border-brand-gold`}>View visitors</button></div></div><div className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Today's attendance</h2><p className="mt-2 text-3xl font-bold text-brand-navy">{todayRecords.length + todayVisitorRecords.length}</p><p className="text-sm text-slate-500">Registered and walk-in entries recorded today (Africa/Lagos).</p></div></div>
      </>}
      {tab === 'people' && <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form onSubmit={register} className="h-fit rounded-2xl border bg-white p-5">
          <h2 className="mb-4 font-bold">Register a person</h2>
          {([['fullName', 'Full name'], ['username', 'Username'], ['phone', 'Phone number'], ['email', 'Email (optional)'], ['department', 'Department / Programme']] as const).map(([key, label]) => <label key={key} className="mb-3 block text-sm font-medium">{label}<input required={key !== 'email'} maxLength={key === 'username' ? 24 : undefined} value={form[key]} onChange={event => setForm({ ...form, [key]: key === 'username' ? event.target.value.toLowerCase().replace(/\s+/g, '-') : event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2"/>{key === 'username' && <span className="text-xs text-slate-500">3–24 letters, numbers, or hyphens; must be unique.</span>}</label>)}
          <label className="mb-4 block text-sm font-medium">Category<select value={form.category} onChange={event => {
            const nextCategory = event.target.value as UserCategory;
            setForm(current => ({
              ...current,
              category: nextCategory,
              ...(nextCategory === 'SUBSCRIBER' && !current.subscriptionStartDate
                ? { subscriptionStartDate: today }
                : {})
            }));
          }} className="mt-1 w-full rounded-xl border px-3 py-2">{(Object.keys(categoryLabels) as UserCategory[]).map(userCategory => <option key={userCategory} value={userCategory}>{categoryLabels[userCategory]}</option>)}</select><span className="mt-1 block text-xs text-slate-500">{categoryDescriptions[form.category]}</span></label>
          {form.category === 'SUBSCRIBER' && <div className="space-y-3 rounded-xl bg-slate-50 p-3">
            <label className="block text-sm font-medium">Subscription plan<select required value={form.subscriptionPlan} onChange={event => setForm({ ...form, subscriptionPlan: event.target.value as SubscriptionPlan })} className="mt-1 w-full rounded-xl border px-3 py-2">{Object.entries(subscriptionPlanLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-sm font-medium">Subscription start date<input required type="date" value={form.subscriptionStartDate} onChange={event => setForm({ ...form, subscriptionStartDate: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
            <label className="block text-sm font-medium">Subscription expiry date<input required type="date" min={form.subscriptionStartDate || undefined} value={form.subscriptionExpiryDate} onChange={event => setForm({ ...form, subscriptionExpiryDate: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
          </div>}
          <button disabled={busy} className="w-full rounded-xl bg-brand-navy px-4 py-3 font-semibold text-white">{busy ? 'Saving...' : 'Register user'}</button>
        </form>
        <div className="rounded-2xl border bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Registered users ({visiblePeople.length})</h2><div className="flex flex-wrap gap-2"><input value={q} onChange={event => setQ(event.target.value)} placeholder="Search name or username" className="rounded-xl border px-3 py-2 text-sm"/><select value={category} onChange={event => setCategory(event.target.value)} className="rounded-xl border px-3 py-2 text-sm"><option value="ALL">All categories</option>{(Object.keys(categoryLabels) as UserCategory[]).map(userCategory => <option key={userCategory} value={userCategory}>{categoryPluralLabels[userCategory]}</option>)}</select></div></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-brand-gold-soft text-brand-navy-dark"><tr>{['Name / Username', 'Category', 'Department', 'Subscription', 'Days attended', 'Status', 'Action'].map(heading => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
            <tbody>{visiblePeople.map(person => <tr key={person.id} className="border-t">
              <td className="p-3"><b>{person.fullName}</b><div className="text-xs text-slate-500">@{person.username || 'pending backfill'}</div></td>
              <td className="p-3">{categoryLabels[person.category]}</td>
              <td className="p-3">{person.department}</td>
              <td className="p-3">{person.category === 'SUBSCRIBER' && person.subscriptionPlan ? <>{subscriptionPlanLabels[person.subscriptionPlan]}<div className="text-xs text-slate-500">{person.subscriptionStartDate?.slice(0, 10)} – {person.subscriptionExpiryDate?.slice(0, 10)}</div></> : '—'}</td>
              <td className="p-3">{person.daysAttended}</td>
              <td className="p-3">{person.active ? 'Active' : 'Inactive'}</td>
              <td className="p-3"><div className="flex flex-wrap gap-2">
                <button onClick={() => void editPerson(person)} className="text-brand-navy underline">Edit</button>
                <button onClick={() => void updatePerson(person, !person.active)} className="text-brand-navy underline">{person.active ? 'Deactivate' : 'Activate'}</button>
                <button disabled={busy} onClick={() => void deletePerson(person)} className="text-red-700 underline disabled:opacity-50">Delete</button>
              </div></td>
            </tr>)}</tbody>
          </table></div>
        </div>
      </div>}
      {tab === 'attendance' && <div className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Attendance records ({visibleRecords.length})</h2><p className="mt-1 text-xs text-slate-500">Updates automatically every 10 seconds.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setAttendanceRefresh(value => value + 1)} className={`${button} border`}>Refresh</button><input type="date" value={date} onChange={event => setDate(event.target.value)} className="rounded-xl border px-3 py-2 text-sm"/><input value={q} onChange={event => setQ(event.target.value)} placeholder="Search name or username" className="rounded-xl border px-3 py-2 text-sm"/><select value={category} onChange={event => setCategory(event.target.value)} className="rounded-xl border px-3 py-2 text-sm"><option value="ALL">All categories</option>{(Object.keys(categoryLabels) as UserCategory[]).map(userCategory => <option key={userCategory} value={userCategory}>{categoryPluralLabels[userCategory]}</option>)}</select></div></div>
        {attendanceError && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{attendanceError}</p>}
        <div className="mb-4 flex gap-2"><button onClick={() => void exportReport('xlsx')} className={`${button} bg-brand-navy text-white`}>Export Excel</button><button onClick={() => void exportReport('pdf')} className={`${button} border-2 border-brand-gold bg-brand-gold-soft text-brand-navy`}>Export PDF</button></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-brand-gold-soft text-brand-navy-dark"><tr>{['Name / Username', 'Category', 'Department', 'Subscription', 'Date', 'Time', 'Days attended', 'Status', 'Action'].map(heading => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
          <tbody>{visibleRecords.map(record => <tr key={record.id} className="border-t">
            <td className="p-3"><b>{record.name}</b><div className="text-xs text-slate-500">@{record.username || 'pending backfill'}</div></td>
            <td className="p-3">{categoryLabels[record.category]}</td>
            <td className="p-3">{record.department}</td>
            <td className="p-3">{record.category === 'SUBSCRIBER' && record.subscriptionPlan ? <>{subscriptionPlanLabels[record.subscriptionPlan]}<div className="text-xs text-slate-500">{record.subscriptionStartDate} – {record.subscriptionExpiryDate}</div></> : '—'}</td>
            <td className="p-3">{record.date}</td>
            <td className="p-3">{record.time}</td>
            <td className="p-3">{record.daysAttended}</td>
            <td className="p-3"><span className="rounded-full bg-green-50 px-2 py-1 text-green-700">{record.status}</span></td>
            <td className="p-3"><button disabled={busy} onClick={() => void deleteAttendance(record)} className="text-red-700 underline disabled:opacity-50">Delete</button></td>
          </tr>)}</tbody>
        </table>{visibleRecords.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No attendance records found.</p>}</div>
      </div>}
      {tab === 'visitors' && <div className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Visitor records ({visibleVisitorRecords.length})</h2><div className="flex flex-wrap gap-2"><button onClick={() => setVisitorRefresh(value => value + 1)} className={`${button} border`}>Refresh</button><input type="date" value={visitorDate} onChange={event => setVisitorDate(event.target.value)} className="rounded-xl border px-3 py-2 text-sm"/><input value={visitorQuery} onChange={event => setVisitorQuery(event.target.value)} placeholder="Search visitor or host" className="rounded-xl border px-3 py-2 text-sm"/></div></div>
        {visitorError && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{visitorError}</p>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-brand-gold-soft text-brand-navy-dark"><tr>{['Visitor name', 'Visiting', 'Date', 'Time', 'Session', 'Action'].map(heading => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
          <tbody>{visibleVisitorRecords.map(record => <tr key={record.id} className="border-t">
            <td className="p-3 font-semibold">{record.visitorName}</td>
            <td className="p-3">{record.hostName}</td>
            <td className="p-3">{record.date}</td>
            <td className="p-3">{record.time}</td>
            <td className="p-3">{record.session}</td>
            <td className="p-3"><button disabled={busy} onClick={() => void deleteVisitorRecord(record)} className="text-red-700 underline disabled:opacity-50">Delete</button></td>
          </tr>)}</tbody>
        </table>{visibleVisitorRecords.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No visitor records found.</p>}</div>
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
          <button disabled={busy} onClick={() => void createSession()} className="mt-5 w-full rounded-xl bg-brand-navy px-4 py-3 font-semibold text-white">{busy ? 'Creating...' : 'Start attendance session'}</button>
          {session ? <p className="mt-4 text-sm text-slate-600">Active session: <b>{session.title}</b>{session.endsAt ? <><br/>Expires: {new Date(session.endsAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</> : <><br/>No expiration. Each person can check in once per day.</>}</p> : <p className="mt-4 text-sm text-amber-700">No active session. Start one before participants check in.</p>}
        </div>
        <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border bg-white p-5 text-center">{qr ? <><h2 className="font-bold">Reusable attendance QR code</h2><img src={qr} alt="Reusable SPARKLAB CREATIVITY AND INNOVATION HUB attendance QR code" className="mt-3 w-72 max-w-full"/><p className="mt-2 text-sm text-slate-500">Print this code once and keep it at the attendance table.</p><a href={qr} download="sparklab-attendance-qr.png" className="mt-3 text-sm font-semibold text-brand-navy underline">Download QR to print</a></> : <><div className="text-5xl text-brand-navy">▦</div><p className="mt-3 font-semibold">QR code is loading</p></>}</div>
      </div>}
    </div>
  </main>;
}
