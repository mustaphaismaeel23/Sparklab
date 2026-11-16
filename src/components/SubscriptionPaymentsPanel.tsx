'use client';
import { useEffect, useState } from 'react';

type Plan = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type PlanPrice = { plan: Plan; amountNgn: number };
type Discount = {
  id: string;
  code: string;
  label: string;
  amountNgn: number;
  plan: Plan | null;
  redemptionCount: number;
  startsOn: string | null;
  expiresOn: string | null;
  active: boolean;
};
type Payment = {
  id: string;
  reference: string;
  name: string;
  username: string | null;
  plan: Plan;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  amountNgn: number;
  discountNgn: number;
  discountCode: string | null;
  createdAt: string;
  paidAt: string | null;
  attendanceRecorded: boolean;
};

const plans: Plan[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
const planLabels: Record<Plan, string> = {
  DAILY: 'Daily Pass',
  WEEKLY: 'Weekly Pass',
  MONTHLY: 'Monthly Pass'
};
const button = 'rounded-xl px-4 py-2 text-sm font-semibold';
const money = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0
});

export default function SubscriptionPaymentsPanel() {
  const [prices, setPrices] = useState<Record<Plan, number>>({
    DAILY: 2500,
    WEEKLY: 10000,
    MONTHLY: 35000
  });
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [form, setForm] = useState({
    code: '',
    label: '',
    amountNgn: '',
    plan: 'ALL',
    startsOn: '',
    expiresOn: ''
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    const response = await fetch('/api/admin/subscriptions', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load subscriber payments.');
    setPrices(Object.fromEntries(data.prices.map((price: PlanPrice) => [price.plan, price.amountNgn])) as Record<Plan, number>);
    setDiscounts(data.discounts);
    setPayments(data.payments);
  }

  useEffect(() => {
    void load().catch(error => setNotice(error instanceof Error ? error.message : 'Could not load subscriber payments.'));
  }, []);

  async function request(url: string, method: string, body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
  }

  async function savePrices(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await request('/api/admin/subscriptions', 'PUT', {
        prices: plans.map(plan => ({ plan, amountNgn: Number(prices[plan]) }))
      });
      setNotice('Subscriber pass prices updated.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update pass prices.');
    } finally {
      setBusy(false);
    }
  }

  async function addDiscount(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await request('/api/admin/subscriptions', 'POST', {
        code: form.code,
        label: form.label,
        amountNgn: Number(form.amountNgn),
        plan: form.plan === 'ALL' ? null : form.plan,
        ...(form.startsOn ? { startsOn: form.startsOn } : {}),
        ...(form.expiresOn ? { expiresOn: form.expiresOn } : {})
      });
      setForm({ code: '', label: '', amountNgn: '', plan: 'ALL', startsOn: '', expiresOn: '' });
      setNotice('Discount code created.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create discount code.');
    } finally {
      setBusy(false);
    }
  }

  async function setDiscountActive(discount: Discount) {
    setBusy(true);
    setNotice('');
    try {
      await request('/api/admin/subscriptions', 'PATCH', { id: discount.id, active: !discount.active });
      setNotice(`Discount code ${discount.active ? 'disabled' : 'enabled'}.`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update discount code.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteDiscount(discount: Discount) {
    if (!window.confirm(`Delete discount code ${discount.code}? Existing payment records will be preserved.`)) return;
    setBusy(true);
    setNotice('');
    try {
      await request('/api/admin/subscriptions', 'DELETE', { id: discount.id });
      setNotice(`Discount code ${discount.code} deleted.`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete discount code.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-5">
    {notice && <p role="status" className="rounded-xl border border-brand-gold bg-brand-gold-soft p-3 text-sm text-brand-navy-dark">{notice}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={savePrices} className="rounded-2xl border bg-white p-5">
        <h2 className="font-bold">Subscriber pass prices</h2>
        <p className="mt-1 text-sm text-slate-500">Prices are charged in Nigerian naira. Changes apply to new checkouts.</p>
        <div className="mt-4 space-y-3">
          {plans.map(plan => <label key={plan} className="block text-sm font-medium">{planLabels[plan]}
            <span className="mt-1 flex items-center rounded-xl border px-3"><span className="text-slate-500">₦</span><input required type="number" min="1" step="1" value={prices[plan]} onChange={event => setPrices({ ...prices, [plan]: Number(event.target.value) })} className="w-full border-0 px-2 py-2 outline-none"/></span>
          </label>)}
        </div>
        <button disabled={busy} className={`${button} mt-4 bg-brand-navy text-white disabled:opacity-50`}>Save prices</button>
      </form>

      <form onSubmit={addDiscount} className="rounded-2xl border bg-white p-5">
        <h2 className="font-bold">Add fixed-amount discount</h2>
        <p className="mt-1 text-sm text-slate-500">Subscribers enter this code before paying. Leave dates blank for no date restriction.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Code<input required minLength={3} maxLength={40} value={form.code} onChange={event => setForm({ ...form, code: event.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
          <label className="text-sm font-medium">Name<input required minLength={2} maxLength={100} value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
          <label className="text-sm font-medium">Discount (NGN)<input required type="number" min="1" step="1" value={form.amountNgn} onChange={event => setForm({ ...form, amountNgn: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
          <label className="text-sm font-medium">Applies to<select value={form.plan} onChange={event => setForm({ ...form, plan: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="ALL">All passes</option>{plans.map(plan => <option key={plan} value={plan}>{planLabels[plan]}</option>)}</select></label>
          <label className="text-sm font-medium">Starts on<input type="date" value={form.startsOn} onChange={event => setForm({ ...form, startsOn: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
          <label className="text-sm font-medium">Expires on<input type="date" min={form.startsOn || undefined} value={form.expiresOn} onChange={event => setForm({ ...form, expiresOn: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
        </div>
        <button disabled={busy} className={`${button} mt-4 bg-brand-navy text-white disabled:opacity-50`}>Create discount code</button>
      </form>
    </div>

    <section className="rounded-2xl border bg-white p-5">
      <h2 className="font-bold">Discount codes ({discounts.length})</h2>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-brand-gold-soft text-brand-navy-dark"><tr>{['Code', 'Discount', 'Pass', 'Validity', 'Uses', 'Status', 'Action'].map(heading => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
        <tbody>{discounts.map(discount => <tr key={discount.id} className="border-t">
          <td className="p-3"><b>{discount.code}</b><div className="text-xs text-slate-500">{discount.label}</div></td>
          <td className="p-3">{money.format(discount.amountNgn)}</td>
          <td className="p-3">{discount.plan ? planLabels[discount.plan] : 'All passes'}</td>
          <td className="p-3">{discount.startsOn || 'Any'} – {discount.expiresOn || 'No expiry'}</td>
          <td className="p-3">{discount.redemptionCount}</td>
          <td className="p-3">{discount.active ? 'Active' : 'Disabled'}</td>
          <td className="p-3"><div className="flex gap-3"><button disabled={busy} onClick={() => void setDiscountActive(discount)} className="text-brand-navy underline disabled:opacity-50">{discount.active ? 'Disable' : 'Enable'}</button><button disabled={busy} onClick={() => void deleteDiscount(discount)} className="text-red-700 underline disabled:opacity-50">Delete</button></div></td>
        </tr>)}</tbody>
      </table>{discounts.length === 0 && <p className="p-5 text-center text-sm text-slate-500">No discount codes created yet.</p>}</div>
    </section>

    <section className="rounded-2xl border bg-white p-5">
      <h2 className="font-bold">Recent subscriber payments (latest {payments.length})</h2>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-brand-gold-soft text-brand-navy-dark"><tr>{['Subscriber', 'Pass', 'Paid', 'Discount', 'Status', 'Date', 'Check-in'].map(heading => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
        <tbody>{payments.map(payment => <tr key={payment.id} className="border-t">
          <td className="p-3"><b>{payment.name}</b><div className="text-xs text-slate-500">@{payment.username || '—'}</div></td>
          <td className="p-3">{planLabels[payment.plan]}</td>
          <td className="p-3">{money.format(payment.amountNgn)}</td>
          <td className="p-3">{payment.discountNgn > 0 ? `${money.format(payment.discountNgn)}${payment.discountCode ? ` (${payment.discountCode})` : ''}` : '—'}</td>
          <td className="p-3">{payment.status}</td>
          <td className="p-3">{new Date(payment.paidAt || payment.createdAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</td>
          <td className="p-3">{payment.status === 'SUCCESS' ? payment.attendanceRecorded ? 'Recorded' : 'Rescan required' : '—'}</td>
        </tr>)}</tbody>
      </table>{payments.length === 0 && <p className="p-5 text-center text-sm text-slate-500">No subscriber payments yet.</p>}</div>
    </section>
  </div>;
}
