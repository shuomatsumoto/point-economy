// src/PointEconomy.tsx
import { useEffect, useMemo, useState } from 'react';
import { PlusCircle, TrendingUp, ArrowRightLeft, BarChart3, CheckCircle } from 'lucide-react';
import { supabase } from './lib/supabaseClient';

type Currency = {
  id: string;
  economy_id: string;
  name: string;
  symbol: string;
  rules: string | null;
  color: string;
  created_at?: string;
};

type Activity = {
  id: string;
  economy_id: string;
  currency_id: string;
  description: string;
  points: number;
  created_at: string;
  created_by: string;
};

type ExchangeRequest = {
  id: string;
  economy_id: string;
  from_currency_id: string;
  to_currency_id: string;
  amount_from: number;
  status: string;
  created_at: string;
  created_by: string;
  finalized_at?: string | null;
  final_rate?: number | null;
  amount_to?: number | null;
};

type RateSubmission = {
  id: string;
  economy_id: string;
  request_id: string;
  submitted_by: string;
  rate: number;
  created_at: string;
};

type ActivityButton = {
  id: string;
  economy_id: string;
  currency_id: string;
  label: string;
  points: number;
  color: string;
  created_by: string;
  created_at: string;
};

type TransferRequest = {
  id: string;
  economy_id: string;
  currency_id: string;
  amount: number;
  memo: string | null;
  from_user: string;
  to_user: string;
  status: 'open' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  responded_at: string | null;
};

type DailySeriesRow = {
  economy_id: string;
  currency_id: string;
  day: string; // date
  delta: number;
  total: number;
  change_rate: number | null;
};

type Props = { economyId: string };

export default function PointEconomy({ economyId }: Props) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'currencies' | 'activities' | 'exchange' | 'transfer' | 'charts'>(
    'dashboard'
  );

  const [me, setMe] = useState<{ id: string; email?: string } | null>(null);

  const [economyName, setEconomyName] = useState<string>('');

  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [myDisplayName, setMyDisplayName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});

  const [newCurrency, setNewCurrency] = useState({ name: '', symbol: '', rules: '', color: '#3b82f6' });
  const [newActivity, setNewActivity] = useState({ currencyId: '', description: '', points: '' });

  const [editingCurrencyId, setEditingCurrencyId] = useState<string>('');
  const [editingRules, setEditingRules] = useState<string>('');

  // Clicker buttons
  const [buttons, setButtons] = useState<ActivityButton[]>([]);
  const [btnForm, setBtnForm] = useState({ currencyId: '', label: '', points: '', color: '#16a34a' });
  const [editingButtonId, setEditingButtonId] = useState<string>('');
  const [editingButton, setEditingButton] = useState({ currencyId: '', label: '', points: '', color: '#16a34a' });

  // Exchange (self wallet convert)
  const [requests, setRequests] = useState<ExchangeRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  const [rateSubmissions, setRateSubmissions] = useState<RateSubmission[]>([]);
  const avgRate = useMemo(() => {
    if (!rateSubmissions.length) return null;
    const sum = rateSubmissions.reduce((s, r) => s + Number(r.rate), 0);
    return sum / rateSubmissions.length;
  }, [rateSubmissions]);

  const [newRequest, setNewRequest] = useState({ fromId: '', toId: '', amount: '' });
  const [myRate, setMyRate] = useState('');

  // Transfer (player-to-player)
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [transferToUser, setTransferToUser] = useState<string>('');
  const [transferCurrencyId, setTransferCurrencyId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferMemo, setTransferMemo] = useState<string>('');

  // Charts
  const [chartCurrencyId, setChartCurrencyId] = useState<string>('');
  const [seriesRows, setSeriesRows] = useState<DailySeriesRow[]>([]);

  // ---------------------------
  // Loaders / Ensurers
  // ---------------------------
  async function loadMe() {
    const { data, error } = await supabase.auth.getSession();
    if (error) return alert(error.message);
    const u = data.session?.user;
    setMe(u ? { id: u.id, email: u.email ?? undefined } : null);
  }

  async function loadEconomyName() {
    const { data, error } = await supabase.from('economies').select('name').eq('id', economyId).maybeSingle();
    if (error) return alert(error.message);
    setEconomyName((data?.name as string) ?? '');
  }

  async function ensureProfileRow() {
    const { data: s, error: e0 } = await supabase.auth.getSession();
    if (e0) return alert(e0.message);
    const user = s.session?.user;
    if (!user) return;

    const { data: p, error: e1 } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (e1) return alert(e1.message);

    if (!p) {
      const display = (user.user_metadata?.display_name as string) || user.email?.split('@')[0] || 'user';
      const { error: e2 } = await supabase.from('profiles').insert({ user_id: user.id, display_name: display });
      if (e2) return alert(e2.message);
    }
  }

  async function loadProfiles() {
    const { data, error } = await supabase.from('profiles').select('user_id, display_name');
    if (error) return alert(error.message);

    const m: Record<string, string> = {};
    (data ?? []).forEach((p: any) => {
      m[p.user_id] = p.display_name || p.user_id.slice(0, 6);
    });
    setProfiles(m);
  }

  async function loadMyProfile() {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return;

    const { data, error } = await supabase.from('profiles').select('display_name').eq('user_id', uid).maybeSingle();

    if (error) return alert(error.message);
    setMyDisplayName((data?.display_name as string) ?? '');
  }

  async function saveMyProfile() {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return;

    const name = myDisplayName.trim();
    if (!name) return alert('表示名を入力してください');

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name, updated_at: new Date().toISOString() })
      .eq('user_id', uid);

    if (error) return alert(error.message);

    await Promise.all([loadProfiles(), loadMyProfile()]);
    alert('保存しました');
  }

  async function loadCurrencies() {
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('economy_id', economyId)
      .order('created_at', { ascending: true });

    if (error) return alert(error.message);
    setCurrencies((data ?? []) as Currency[]);
    if (!chartCurrencyId && (data ?? []).length > 0) setChartCurrencyId(String((data ?? [])[0].id));
  }

  async function loadActivities() {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('economy_id', economyId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return alert(error.message);

    const rows = (data ?? []).map((a: any) => ({
      ...a,
      points: Number(a.points),
    })) as Activity[];
    setActivities(rows);
  }

  async function loadBalances() {
    const { data: s, error: e0 } = await supabase.auth.getSession();
    if (e0) return alert(e0.message);
    const uid = s.session?.user?.id;
    if (!uid) return;

    const { data, error } = await supabase
      .from('currency_balances_by_user')
      .select('currency_id, balance')
      .eq('economy_id', economyId)
      .eq('user_id', uid);

    if (error) return alert(error.message);

    const map: Record<string, number> = {};
    (data ?? []).forEach((r: any) => {
      map[r.currency_id] = Number(r.balance);
    });
    setBalances(map);
  }

  async function loadButtons() {
    const { data, error } = await supabase
      .from('activity_buttons')
      .select('*')
      .eq('economy_id', economyId)
      .order('created_at', { ascending: true });

    if (error) return alert(error.message);

    const rows = (data ?? []).map((b: any) => ({
      ...b,
      points: Number(b.points),
    })) as ActivityButton[];

    setButtons(rows);
  }

  async function loadRequests() {
    const { data, error } = await supabase
      .from('exchange_requests')
      .select('*')
      .eq('economy_id', economyId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return alert(error.message);

    const rows = (data ?? []).map((r: any) => ({
      ...r,
      amount_from: Number(r.amount_from),
      final_rate: r.final_rate == null ? null : Number(r.final_rate),
      amount_to: r.amount_to == null ? null : Number(r.amount_to),
    })) as ExchangeRequest[];

    setRequests(rows);
  }

  async function loadRateSubmissions(requestId: string) {
    if (!requestId) {
      setRateSubmissions([]);
      return;
    }
    const { data, error } = await supabase
      .from('exchange_rate_submissions')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) return alert(error.message);

    const rows = (data ?? []).map((s: any) => ({ ...s, rate: Number(s.rate) })) as RateSubmission[];
    setRateSubmissions(rows);
  }

  async function loadTransfers() {
    const { data, error } = await supabase
      .from('transfer_requests')
      .select('*')
      .eq('economy_id', economyId)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) return alert(error.message);

    const rows = (data ?? []).map((t: any) => ({
      ...t,
      amount: Number(t.amount),
    })) as TransferRequest[];
    setTransfers(rows);
  }

  async function loadSeries() {
    const { data, error } = await supabase
      .from('currency_daily_series')
      .select('economy_id,currency_id,day,delta,total,change_rate')
      .eq('economy_id', economyId)
      .order('day', { ascending: true });

    if (error) return alert(error.message);

    const rows = (data ?? []).map((r: any) => ({
      ...r,
      delta: Number(r.delta),
      total: Number(r.total),
      change_rate: r.change_rate == null ? null : Number(r.change_rate),
    })) as DailySeriesRow[];

    setSeriesRows(rows);
  }

  // ---------------------------
  // Helpers
  // ---------------------------
  function cById(id: string) {
    return currencies.find((c) => c.id === id) ?? null;
  }
  function cLabel(id: string) {
    const c = cById(id);
    return c ? `${c.name} (${c.symbol})` : id.slice(0, 6);
  }
  function who(userId: string) {
    return profiles[userId] || userId.slice(0, 6);
  }
  function myBalance(currencyId: string) {
    return Number(balances[currencyId] ?? 0);
  }

  function UserLink({ userId }: { userId: string }) {
    return (
      <button className="underline decoration-slate-500 hover:decoration-slate-200" onClick={() => setSelectedUserId(userId)}>
        {who(userId)}
      </button>
    );
  }

  const totalValue = useMemo(() => Object.values(balances).reduce((s, v) => s + Number(v), 0), [balances]);

  // Charts derived
  const currencySeries = useMemo(() => {
    if (!chartCurrencyId) return [];
    return seriesRows.filter((r) => r.currency_id === chartCurrencyId);
  }, [seriesRows, chartCurrencyId]);

  const chartPointsTotal = useMemo(() => {
    const pts = currencySeries.map((r) => ({ x: r.day, y: r.total }));
    return pts;
  }, [currencySeries]);

  const chartPointsChange = useMemo(() => {
    const pts = currencySeries.map((r) => ({ x: r.day, y: r.change_rate == null ? 0 : r.change_rate * 100 }));
    return pts;
  }, [currencySeries]);

  // ---------------------------
  // Mutations
  // ---------------------------
  async function addCurrency() {
    if (!newCurrency.name.trim() || !newCurrency.symbol.trim()) return;

    const { error } = await supabase.from('currencies').insert({
      economy_id: economyId,
      name: newCurrency.name.trim(),
      symbol: newCurrency.symbol.trim(),
      rules: newCurrency.rules.trim() ? newCurrency.rules.trim() : null,
      color: newCurrency.color,
    });

    if (error) return alert(error.message);
    setNewCurrency({ name: '', symbol: '', rules: '', color: '#3b82f6' });
    await loadCurrencies();
  }

  async function addActivity() {
    const currencyId = newActivity.currencyId;
    const description = newActivity.description.trim();
    const pts = Number(newActivity.points);
    if (!currencyId || !description || !Number.isFinite(pts)) return;

    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return alert('not authenticated');

    const { error } = await supabase.from('activities').insert({
      economy_id: economyId,
      currency_id: currencyId,
      description,
      points: pts,
      created_by: uid,
    });

    if (error) return alert(error.message);

    setNewActivity({ currencyId: '', description: '', points: '' });
    await Promise.all([loadActivities(), loadBalances(), loadSeries()]);
  }

  // Clicker
  async function createButton() {
    const currencyId = btnForm.currencyId;
    const label = btnForm.label.trim();
    const pts = Number(btnForm.points);
    if (!currencyId || !label || !Number.isFinite(pts)) return alert('ボタンの入力が不正です');

    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return alert('not authenticated');

    const { error } = await supabase.from('activity_buttons').insert({
      economy_id: economyId,
      currency_id: currencyId,
      label,
      points: pts,
      color: btnForm.color || '#16a34a',
      created_by: uid,
    });

    if (error) return alert(error.message);

    setBtnForm({ currencyId: '', label: '', points: '', color: '#16a34a' });
    await loadButtons();
  }

  function startEditButton(b: ActivityButton) {
    setEditingButtonId(b.id);
    setEditingButton({
      currencyId: b.currency_id,
      label: b.label,
      points: String(b.points),
      color: b.color || '#16a34a',
    });
  }
  function cancelEditButton() {
    setEditingButtonId('');
    setEditingButton({ currencyId: '', label: '', points: '', color: '#16a34a' });
  }
  async function saveButton(buttonId: string) {
    const label = editingButton.label.trim();
    const pts = Number(editingButton.points);
    const currencyId = editingButton.currencyId;
    if (!currencyId || !label || !Number.isFinite(pts)) return alert('編集内容が不正です');

    const { error } = await supabase
      .from('activity_buttons')
      .update({ currency_id: currencyId, label, points: pts, color: editingButton.color || '#16a34a' })
      .eq('id', buttonId)
      .eq('economy_id', economyId);

    if (error) return alert(error.message);

    await loadButtons();
    cancelEditButton();
  }
  async function deleteButton(buttonId: string) {
    if (!confirm('このボタンを削除しますか？')) return;
    const { error } = await supabase.from('activity_buttons').delete().eq('id', buttonId).eq('economy_id', economyId);
    if (error) return alert(error.message);
    await loadButtons();
  }
  async function pressButton(b: ActivityButton) {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return alert('not authenticated');

    const { error } = await supabase.from('activities').insert({
      economy_id: economyId,
      currency_id: b.currency_id,
      description: b.label,
      points: Number(b.points),
      created_by: uid,
    });

    if (error) return alert(error.message);

    await Promise.all([loadActivities(), loadBalances(), loadSeries()]);
  }

  // Exchange (self)
  async function createRequest() {
    const fromId = newRequest.fromId;
    const toId = newRequest.toId;
    const amt = Number(newRequest.amount);

    if (!fromId || !toId || !Number.isFinite(amt) || amt <= 0) return;
    if (fromId === toId) return alert('交換元と交換先は別にしてください');
    if (myBalance(fromId) < amt) return alert('残高不足です');

    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return alert('not authenticated');

    const { data, error } = await supabase
      .from('exchange_requests')
      .insert({
        economy_id: economyId,
        from_currency_id: fromId,
        to_currency_id: toId,
        amount_from: amt,
        status: 'open',
        created_by: uid,
      })
      .select('*')
      .single();

    if (error) return alert(error.message);

    setNewRequest({ fromId: '', toId: '', amount: '' });
    await loadRequests();
    if (data?.id) setSelectedRequestId(String(data.id));
  }

  async function submitRate() {
    if (!selectedRequest) return;

    const rate = Number(myRate);
    if (!Number.isFinite(rate) || rate <= 0) return alert('rate を正しく入力してください');

    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return alert('not authenticated');

    const { error } = await supabase.from('exchange_rate_submissions').upsert(
      { economy_id: selectedRequest.economy_id, request_id: selectedRequest.id, submitted_by: uid, rate },
      { onConflict: 'request_id,submitted_by' }
    );

    if (error) return alert(error.message);

    setMyRate('');
    await loadRateSubmissions(selectedRequest.id);
  }

  async function finalizeSelected() {
    if (!selectedRequest) return;
    const { error } = await supabase.rpc('finalize_exchange_request', { p_request_id: selectedRequest.id });
    if (error) return alert(error.message);
    await Promise.all([loadRequests(), loadBalances(), loadSeries()]);
  }

  // Currency rules edit
  function startEditRules(c: Currency) {
    setEditingCurrencyId(c.id);
    setEditingRules(c.rules ?? '');
  }
  function cancelEditRules() {
    setEditingCurrencyId('');
    setEditingRules('');
  }
  async function saveRules(currencyId: string) {
    const next = editingRules.trim();
    const { error } = await supabase.from('currencies').update({ rules: next ? next : null }).eq('id', currencyId).eq('economy_id', economyId);
    if (error) return alert(error.message);
    await loadCurrencies();
    cancelEditRules();
    alert('ルールを保存しました');
  }

  // Transfer (player-to-player)
  async function createTransfer() {
    if (!transferToUser) return alert('相手（to_user）を選んでください');
    if (!transferCurrencyId) return alert('通貨を選んでください');
    const amt = Number(transferAmount);
    if (!Number.isFinite(amt) || amt <= 0) return alert('amount を正しく入力してください');
    if (me?.id && transferToUser === me.id) return alert('自分自身には送れません');
    if (myBalance(transferCurrencyId) < amt) return alert('残高不足です');

    const { data, error } = await supabase.rpc('create_transfer_request', {
      p_economy_id: economyId,
      p_currency_id: transferCurrencyId,
      p_to_user: transferToUser,
      p_amount: amt,
      p_memo: transferMemo.trim() ? transferMemo.trim() : null,
    });

    if (error) return alert(error.message);

    setTransferAmount('');
    setTransferMemo('');
    await loadTransfers();
    alert(`送金リクエストを作成しました: ${String(data).slice(0, 8)}…`);
  }

  async function acceptTransfer(id: string) {
    const { error } = await supabase.rpc('accept_transfer_request', { p_request_id: id });
    if (error) return alert(error.message);
    await Promise.all([loadTransfers(), loadBalances(), loadActivities(), loadSeries()]);
  }

  async function rejectTransfer(id: string) {
    const { error } = await supabase.rpc('reject_transfer_request', { p_request_id: id });
    if (error) return alert(error.message);
    await loadTransfers();
  }

  async function cancelTransfer(id: string) {
    const { error } = await supabase.rpc('cancel_transfer_request', { p_request_id: id });
    if (error) return alert(error.message);
    await loadTransfers();
  }

  // ---------------------------
  // Effects
  // ---------------------------
  useEffect(() => {
    if (!economyId) return;

    (async () => {
      await loadMe();
      await ensureProfileRow();
      await Promise.all([
        loadEconomyName(),
        loadProfiles(),
        loadMyProfile(),
        loadCurrencies(),
        loadActivities(),
        loadBalances(),
        loadButtons(),
        loadRequests(),
        loadTransfers(),
        loadSeries(),
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [economyId]);

  useEffect(() => {
    if (!selectedRequestId) {
      setRateSubmissions([]);
      setMyRate('');
      return;
    }
    loadRateSubmissions(selectedRequestId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRequestId]);

  // ---------------------------
  // UI helpers
  // ---------------------------
  function Badge({ text }: { text: string }) {
    return <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200">{text}</span>;
  }

  // SVG simple chart
  function SimpleLineChart({
    title,
    points,
    height = 180,
    valueFormat,
  }: {
    title: string;
    points: { x: string; y: number }[];
    height?: number;
    valueFormat: (v: number) => string;
  }) {
    const width = 900; // viewBox width
    const pad = 24;

    const ys = points.map((p) => p.y);
    const minY = ys.length ? Math.min(...ys) : 0;
    const maxY = ys.length ? Math.max(...ys) : 1;
    const span = maxY - minY || 1;

    const toX = (i: number) => {
      if (points.length <= 1) return pad;
      return pad + (i * (width - pad * 2)) / (points.length - 1);
    };
    const toY = (v: number) => {
      const t = (v - minY) / span;
      return pad + (1 - t) * (height - pad * 2);
    };

    const path = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(2)} ${toY(p.y).toFixed(2)}`)
      .join(' ');

    const last = points.length ? points[points.length - 1] : null;

    return (
      <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold">{title}</div>
          {last ? <Badge text={`${last.x} / ${valueFormat(last.y)}`} /> : <Badge text="no data" />}
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[180px]">
          {/* axes */}
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgba(148,163,184,.5)" strokeWidth="1" />
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(148,163,184,.5)" strokeWidth="1" />
          {/* line */}
          <path d={path} fill="none" stroke="rgba(168,85,247,.9)" strokeWidth="2.2" />
        </svg>
        <div className="text-xs text-slate-400 mt-2">
          min: {valueFormat(minY)} / max: {valueFormat(maxY)} / points: {points.length}
        </div>
      </div>
    );
  }

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-4xl font-bold mb-1 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {economyName || 'Economy'}
          </h1>
          <p className="text-slate-300 text-sm">
            economy: <span className="font-mono">{economyId}</span>
            {me ? (
              <>
                {' '}
                / user:{' '}
                <button className="font-semibold underline decoration-slate-500 hover:decoration-slate-200" onClick={() => setSelectedUserId(me.id)}>
                  {who(me.id)}
                </button>
              </>
            ) : null}
          </p>
        </header>

        <nav className="flex flex-wrap gap-2 mb-6 bg-slate-800/50 p-2 rounded-lg backdrop-blur">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'ダッシュボード' },
            { id: 'currencies', icon: TrendingUp, label: 'ポイント銘柄' },
            { id: 'activities', icon: CheckCircle, label: '活動記録' },
            { id: 'exchange', icon: ArrowRightLeft, label: '交換（自分）' },
            { id: 'transfer', icon: ArrowRightLeft, label: 'やり取り（送金）' },
            { id: 'charts', icon: BarChart3, label: 'Charts' },
          ].map((tab: any) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
                <div className="text-slate-400 text-sm mb-2">総ポイント（自分財布の合計）</div>
                <div className="text-3xl font-bold">{totalValue.toFixed(2)}</div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
                <div className="text-slate-400 text-sm mb-2">保有銘柄数</div>
                <div className="text-3xl font-bold">{currencies.length}</div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
                <div className="text-slate-400 text-sm mb-2">活動数（全体）</div>
                <div className="text-3xl font-bold">{activities.length}</div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <h2 className="text-xl font-bold mb-3">プロフィール</h2>
              <div className="text-sm text-slate-300 mb-2">
                現在の表示名: <span className="font-semibold">{myDisplayName || '(未設定)'}</span>
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                  placeholder="表示名（例：Shuo）"
                  value={myDisplayName}
                  onChange={(e) => setMyDisplayName(e.target.value)}
                />
                <button onClick={saveMyProfile} className="px-4 rounded bg-purple-600 hover:bg-purple-700 font-semibold">
                  保存
                </button>
              </div>
              <div className="text-xs text-slate-400 mt-2">※表示名は activities / exchange / transfer の「by:」表示に反映されます</div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp size={24} />
                  保有ポイント（自分）
                </h2>
                <button onClick={loadBalances} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">
                  残高再計算
                </button>
              </div>

              <div className="space-y-3">
                {currencies.map((currency) => (
                  <div key={currency.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: currency.color }} />
                      <div>
                        <div className="font-semibold">{currency.name}</div>
                        <div className="text-sm text-slate-400">{currency.symbol}</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold">{myBalance(currency.id).toFixed(2)}</div>
                  </div>
                ))}
                {currencies.length === 0 && <p className="text-slate-400 text-center py-8">まだ銘柄がありません</p>}
              </div>
            </div>
          </div>
        )}

        {/* Currencies */}
        {activeTab === 'currencies' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <PlusCircle size={24} />
                新しいポイント銘柄を作成
              </h2>

              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="銘柄名"
                  value={newCurrency.name}
                  onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="シンボル"
                  value={newCurrency.symbol}
                  onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />
                <textarea
                  placeholder="獲得ルール"
                  value={newCurrency.rules}
                  onChange={(e) => setNewCurrency({ ...newCurrency, rules: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none h-24"
                />
                <div className="flex items-center gap-3">
                  <label className="text-slate-300">カラー:</label>
                  <input
                    type="color"
                    value={newCurrency.color}
                    onChange={(e) => setNewCurrency({ ...newCurrency, color: e.target.value })}
                    className="w-16 h-10 rounded cursor-pointer"
                  />
                </div>

                <button onClick={addCurrency} className="w-full bg-purple-600 hover:bg-purple-700 p-3 rounded font-semibold">
                  作成する
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">登録済み銘柄</h2>
                <button onClick={loadCurrencies} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">
                  再読み込み
                </button>
              </div>

              <div className="space-y-4">
                {currencies.map((currency) => {
                  const isEditing = editingCurrencyId === currency.id;
                  return (
                    <div key={currency.id} className="p-4 bg-slate-700/50 rounded">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: currency.color }} />
                          <div className="font-bold text-lg">{currency.name}</div>
                          <div className="text-slate-400">({currency.symbol})</div>
                        </div>

                        {!isEditing ? (
                          <button onClick={() => startEditRules(currency)} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm">
                            ルール編集
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveRules(currency.id)}
                              className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-sm font-semibold"
                            >
                              保存
                            </button>
                            <button onClick={cancelEditRules} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm">
                              キャンセル
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        {!isEditing ? (
                          <div className="text-sm text-slate-300 p-3 bg-slate-800/50 rounded">
                            <div className="font-semibold text-slate-400 mb-1">獲得ルール:</div>
                            {currency.rules ? <div className="whitespace-pre-wrap">{currency.rules}</div> : <div className="text-slate-500">（未設定）</div>}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-300 p-3 bg-slate-800/50 rounded">
                            <div className="font-semibold text-slate-400 mb-2">獲得ルール（編集）:</div>
                            <textarea
                              className="w-full p-3 bg-slate-900 rounded border border-slate-700 focus:border-purple-500 outline-none h-28"
                              value={editingRules}
                              onChange={(e) => setEditingRules(e.target.value)}
                              placeholder="例：30分読書で10pt"
                            />
                            <div className="text-xs text-slate-500 mt-2">空にして保存すると「未設定（null）」になります。</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {currencies.length === 0 && <p className="text-slate-400 text-center py-8">まだ銘柄がありません</p>}
              </div>
            </div>
          </div>
        )}

        {/* Activities (clicker + manual + history) */}
        {activeTab === 'activities' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="text-xl font-bold">ClickPad（押すだけで加算）</h2>
                <button onClick={loadButtons} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">
                  ボタン再読み込み
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {buttons.map((b) => (
                  <div key={b.id} className="bg-slate-900/40 border border-slate-700 rounded-lg p-3">
                    <button onClick={() => pressButton(b)} className="w-full p-3 rounded font-semibold" style={{ backgroundColor: b.color || '#16a34a' }}>
                      {b.label}
                      <div className="text-xs opacity-90 mt-1">
                        +{Number(b.points).toFixed(2)} / {cById(b.currency_id)?.symbol ?? '—'}
                      </div>
                    </button>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                      <div>{cById(b.currency_id)?.symbol ?? '—'}</div>
                      <div className="text-slate-400">by {who(b.created_by)}</div>
                    </div>

                    {me?.id === b.created_by && (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => startEditButton(b)} className="flex-1 px-2 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs">
                          編集
                        </button>
                        <button onClick={() => deleteButton(b.id)} className="flex-1 px-2 py-2 rounded bg-red-700/70 hover:bg-red-700 text-xs">
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {buttons.length === 0 && <div className="text-slate-400">まだボタンがありません</div>}
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4">
                  <div className="font-semibold mb-3">新規ボタン作成</div>
                  <div className="space-y-3">
                    <select
                      value={btnForm.currencyId}
                      onChange={(e) => setBtnForm({ ...btnForm, currencyId: e.target.value })}
                      className="w-full p-3 bg-slate-800 rounded border border-slate-700 focus:border-purple-500 outline-none"
                    >
                      <option value="">通貨を選択</option>
                      {currencies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.symbol})
                        </option>
                      ))}
                    </select>

                    <input
                      className="w-full p-3 bg-slate-800 rounded border border-slate-700 focus:border-purple-500 outline-none"
                      placeholder="ラベル（例：英語10分）"
                      value={btnForm.label}
                      onChange={(e) => setBtnForm({ ...btnForm, label: e.target.value })}
                    />

                    <input
                      className="w-full p-3 bg-slate-800 rounded border border-slate-700 focus:border-purple-500 outline-none"
                      type="number"
                      step="0.01"
                      placeholder="加算ポイント（例：5）"
                      value={btnForm.points}
                      onChange={(e) => setBtnForm({ ...btnForm, points: e.target.value })}
                    />

                    <div className="flex items-center gap-3">
                      <label className="text-slate-300 text-sm">色:</label>
                      <input type="color" value={btnForm.color} onChange={(e) => setBtnForm({ ...btnForm, color: e.target.value })} className="w-16 h-10 rounded cursor-pointer" />
                    </div>

                    <button onClick={createButton} className="w-full bg-green-600 hover:bg-green-700 p-3 rounded font-semibold">
                      ボタン作成
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4">
                  <div className="font-semibold mb-3">ボタン編集</div>

                  {editingButtonId ? (
                    <div className="space-y-3">
                      <select
                        value={editingButton.currencyId}
                        onChange={(e) => setEditingButton({ ...editingButton, currencyId: e.target.value })}
                        className="w-full p-3 bg-slate-800 rounded border border-slate-700 focus:border-purple-500 outline-none"
                      >
                        <option value="">通貨を選択</option>
                        {currencies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.symbol})
                          </option>
                        ))}
                      </select>

                      <input className="w-full p-3 bg-slate-800 rounded border border-slate-700 focus:border-purple-500 outline-none" placeholder="ラベル" value={editingButton.label} onChange={(e) => setEditingButton({ ...editingButton, label: e.target.value })} />

                      <input className="w-full p-3 bg-slate-800 rounded border border-slate-700 focus:border-purple-500 outline-none" type="number" step="0.01" placeholder="加算ポイント" value={editingButton.points} onChange={(e) => setEditingButton({ ...editingButton, points: e.target.value })} />

                      <div className="flex items-center gap-3">
                        <label className="text-slate-300 text-sm">色:</label>
                        <input type="color" value={editingButton.color} onChange={(e) => setEditingButton({ ...editingButton, color: e.target.value })} className="w-16 h-10 rounded cursor-pointer" />
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => saveButton(editingButtonId)} className="flex-1 bg-purple-600 hover:bg-purple-700 p-3 rounded font-semibold">
                          保存
                        </button>
                        <button onClick={cancelEditButton} className="flex-1 bg-slate-800 hover:bg-slate-700 p-3 rounded font-semibold">
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm">編集したいボタンの「編集」を押してください（作成者のみ）。</div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <CheckCircle size={24} />
                活動を手入力（保険）
              </h2>

              <div className="space-y-4">
                <select
                  value={newActivity.currencyId}
                  onChange={(e) => setNewActivity({ ...newActivity, currencyId: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                >
                  <option value="">ポイント銘柄を選択</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.symbol})
                    </option>
                  ))}
                </select>

                <input type="text" placeholder="活動内容" value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })} className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none" />

                <input type="number" step="0.01" placeholder="獲得ポイント" value={newActivity.points} onChange={(e) => setNewActivity({ ...newActivity, points: e.target.value })} className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none" />

                <button onClick={addActivity} className="w-full bg-green-600 hover:bg-green-700 p-3 rounded font-semibold transition">
                  記録する
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">活動履歴（全体）</h2>
                <button
                  onClick={async () => {
                    await Promise.all([loadActivities(), loadBalances(), loadProfiles(), loadButtons(), loadSeries()]);
                  }}
                  className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                >
                  再読み込み
                </button>
              </div>

              <div className="space-y-2">
                {activities.map((a) => (
                  <div key={a.id} className="p-4 bg-slate-700/50 rounded">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold">{a.description}</div>
                        <div className="text-sm text-slate-400 mt-1">
                          {new Date(a.created_at).toLocaleString('ja-JP')} / <UserLink userId={a.created_by} /> / {cLabel(a.currency_id)}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-green-400 font-bold text-lg">+{Number(a.points).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && <p className="text-slate-400 text-center py-8">まだ活動記録がありません</p>}
              </div>
            </div>
          </div>
        )}

        {/* Exchange (self convert) */}
        {activeTab === 'exchange' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ArrowRightLeft size={24} />
                交換リクエスト作成（自分財布）
              </h2>

              <div className="space-y-4">
                <select value={newRequest.fromId} onChange={(e) => setNewRequest({ ...newRequest, fromId: e.target.value })} className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none">
                  <option value="">交換元ポイント</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (自分残高: {myBalance(c.id).toFixed(2)})
                    </option>
                  ))}
                </select>

                <select value={newRequest.toId} onChange={(e) => setNewRequest({ ...newRequest, toId: e.target.value })} className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none">
                  <option value="">交換先ポイント</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <input type="number" step="0.01" placeholder="交換量（from）" value={newRequest.amount} onChange={(e) => setNewRequest({ ...newRequest, amount: e.target.value })} className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none" />

                <button onClick={createRequest} className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded font-semibold">
                  Request作成
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">RequestList</h2>
                  <button onClick={loadRequests} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">
                    再読み込み
                  </button>
                </div>

                <div className="space-y-2">
                  {requests.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRequestId(r.id)}
                      className={`w-full text-left p-3 rounded border transition ${
                        selectedRequestId === r.id ? 'bg-purple-700/40 border-purple-500' : 'bg-slate-700/30 border-slate-700 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="text-sm font-semibold">
                        {cById(r.from_currency_id)?.symbol ?? '???'} → {cById(r.to_currency_id)?.symbol ?? '???'}
                      </div>
                      <div className="text-xs text-slate-300 mt-1">
                        amount_from: {Number(r.amount_from).toFixed(2)} / status: {r.status} / by: <UserLink userId={r.created_by} />
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{new Date(r.created_at).toLocaleString('ja-JP')}</div>
                    </button>
                  ))}
                  {requests.length === 0 && <p className="text-slate-400 text-center py-8">まだrequestがありません</p>}
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
                <h2 className="text-xl font-bold mb-4">RequestDetail</h2>

                {!selectedRequest ? (
                  <div className="text-slate-300">左のリストから request を選んでください。</div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-700/40 rounded">
                      <div className="font-semibold">
                        {cLabel(selectedRequest.from_currency_id)} → {cLabel(selectedRequest.to_currency_id)}
                      </div>
                      <div className="text-sm text-slate-300 mt-1">
                        amount_from: {Number(selectedRequest.amount_from).toFixed(2)} / status: {selectedRequest.status}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        by <UserLink userId={selectedRequest.created_by} /> / {new Date(selectedRequest.created_at).toLocaleString('ja-JP')}
                      </div>
                      {selectedRequest.status === 'finalized' && (
                        <div className="text-xs text-slate-200 mt-2">
                          final_rate: {selectedRequest.final_rate ?? '—'} / amount_to: {selectedRequest.amount_to ?? '—'}
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-slate-700/30 rounded">
                      <div className="font-semibold mb-2">SubmitRate</div>

                      <input type="number" step="0.000001" placeholder="rate（例：2.0）" value={myRate} onChange={(e) => setMyRate(e.target.value)} className="w-full p-3 bg-slate-800 rounded border border-slate-600 focus:border-purple-500 outline-none" />

                      <button onClick={submitRate} className="w-full mt-3 bg-green-600 hover:bg-green-700 p-3 rounded font-semibold">
                        レート提出
                      </button>

                      <button onClick={finalizeSelected} className="w-full mt-3 bg-purple-600 hover:bg-purple-700 p-3 rounded font-semibold">
                        Finalize（平均で確定）
                      </button>
                    </div>

                    <div className="p-4 bg-slate-700/20 rounded">
                      <div className="font-semibold mb-2">提出済みレート{avgRate != null ? `（平均: ${avgRate.toFixed(6)}）` : ''}</div>

                      <div className="space-y-2">
                        {rateSubmissions.map((s) => (
                          <div key={s.id} className="flex items-center justify-between p-3 bg-slate-800/60 rounded">
                            <div className="text-sm">
                              <UserLink userId={s.submitted_by} />
                            </div>
                            <div className="font-mono text-sm">{Number(s.rate).toFixed(6)}</div>
                          </div>
                        ))}
                        {rateSubmissions.length === 0 && <div className="text-slate-300">まだ提出がありません</div>}
                      </div>
                    </div>

                    <div className="text-xs text-slate-400">※ finalize 後の残高反映は「自分財布」に対して行われます（currency_balances_by_user）。</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Transfer (player-to-player) */}
        {activeTab === 'transfer' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">送金リクエスト（プレイヤー間）</h2>
                <button onClick={loadTransfers} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">
                  再読み込み
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4">
                  <div className="font-semibold mb-3">送金リクエストを作る</div>

                  <div className="space-y-3">
                    <div className="text-xs text-slate-400">
                      相手は profiles から選びます（同一 economy 内のメンバー）。「自分以外」を選択してください。
                    </div>

                    <select value={transferToUser} onChange={(e) => setTransferToUser(e.target.value)} className="w-full p-3 bg-slate-800 rounded border border-slate-700 focus:border-purple-500 outline-none">
                      <option value="">送金先（to_user）</option>
                      {Object.keys(profiles)
                        .filter((uid) => uid !== me?.id)
                        .map((uid) => (
                          <option key={uid} value={uid}>
                            {profiles[uid]} ({uid.slice(0, 6)})
                          </option>
                        ))}
                    </select>

                    <select value={transferCurrencyId} onChange={(e) => setTransferCurrencyId(e.target.value)} className="w-full p-3 bg-slate-800 rounded border border-slate-700 focus:border-purple-500 outline-none">
                      <option value="">通貨</option>
                      {currencies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.symbol}) / 自分残高: {myBalance(c.id).toFixed(2)}
                        </option>
                      ))}
                    </select>

                    <input type="number" step="0.01" placeholder="amount" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className="w-full p-3 bg-slate-800 rounded border border-slate-700 focus:border-purple-500 outline-none" />

                    <input placeholder="メモ（任意）" value={transferMemo} onChange={(e) => setTransferMemo(e.target.value)} className="w-full p-3 bg-slate-800 rounded border border-slate-700 focus:border-purple-500 outline-none" />

                    <button onClick={createTransfer} className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded font-semibold">
                      送金Request作成
                    </button>

                    <div className="text-xs text-slate-400">
                      受け手が Accept すると、activities に「送信者 -amount / 受信者 +amount」が記録され、残高が動きます。
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4">
                  <div className="font-semibold mb-3">受信中（あなた宛て / open）</div>

                  <div className="space-y-2">
                    {transfers
                      .filter((t) => t.to_user === me?.id && t.status === 'open')
                      .map((t) => (
                        <div key={t.id} className="p-3 rounded bg-slate-800/70 border border-slate-700">
                          <div className="text-sm font-semibold">
                            {cById(t.currency_id)?.symbol ?? '???'} +{Number(t.amount).toFixed(2)}
                          </div>
                          <div className="text-xs text-slate-300 mt-1">
                            from: <UserLink userId={t.from_user} /> / memo: {t.memo ?? '—'}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">{new Date(t.created_at).toLocaleString('ja-JP')}</div>
                          <div className="mt-2 flex gap-2">
                            <button onClick={() => acceptTransfer(t.id)} className="flex-1 bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm font-semibold">
                              Accept
                            </button>
                            <button onClick={() => rejectTransfer(t.id)} className="flex-1 bg-red-700/70 hover:bg-red-700 px-3 py-2 rounded text-sm font-semibold">
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    {transfers.filter((t) => t.to_user === me?.id && t.status === 'open').length === 0 && <div className="text-slate-400 text-sm">受信中のリクエストはありません</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">送金履歴（全体）</h2>
                <button
                  onClick={async () => {
                    await Promise.all([loadTransfers(), loadBalances(), loadActivities(), loadSeries()]);
                  }}
                  className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                >
                  再読み込み
                </button>
              </div>

              <div className="space-y-2">
                {transfers.map((t) => (
                  <div key={t.id} className="p-3 rounded bg-slate-700/30 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        {cById(t.currency_id)?.symbol ?? '???'} {Number(t.amount).toFixed(2)} <span className="text-slate-400">({t.status})</span>
                      </div>
                      <div className="text-xs text-slate-400">{new Date(t.created_at).toLocaleString('ja-JP')}</div>
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
                      from <UserLink userId={t.from_user} /> → to <UserLink userId={t.to_user} /> / memo: {t.memo ?? '—'}
                    </div>

                    {t.status === 'open' && t.from_user === me?.id && (
                      <div className="mt-2">
                        <button onClick={() => cancelTransfer(t.id)} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm">
                          Cancel（送信者）
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {transfers.length === 0 && <div className="text-slate-400 text-sm">まだ送金履歴がありません</div>}
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        {activeTab === 'charts' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-xl font-bold">通貨の「総資産」推移（活動ベース）</h2>
                <div className="flex gap-2">
                  <button onClick={loadSeries} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">
                    データ再読み込み
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
                <div className="lg:col-span-2">
                  <select value={chartCurrencyId} onChange={(e) => setChartCurrencyId(e.target.value)} className="w-full p-3 bg-slate-800 rounded border border-slate-700 focus:border-purple-500 outline-none">
                    <option value="">通貨を選択</option>
                    {currencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-slate-400 flex items-center">
                  total = activitiesの累積（全員ぶん） / change% = 前日比（%）
                </div>
              </div>

              {chartCurrencyId ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <SimpleLineChart title="Total（総量）" points={chartPointsTotal} valueFormat={(v) => v.toFixed(2)} />
                  <SimpleLineChart title="Change %（前日比）" points={chartPointsChange} valueFormat={(v) => `${v.toFixed(2)}%`} />
                </div>
              ) : (
                <div className="text-slate-400">通貨を選択してください</div>
              )}

              <div className="mt-4 text-xs text-slate-400">
                ※ここはまず「株価っぽく見える」最短実装です。交換（exchanges）まで総量推移に混ぜたい場合は、あなたの exchanges テーブルの列名を合わせて view を拡張します。
              </div>
            </div>
          </div>
        )}

        {/* Profile modal */}
        <MemberProfileModal
          open={!!selectedUserId}
          onClose={() => setSelectedUserId('')}
          economyId={economyId}
          userId={selectedUserId}
          profiles={profiles}
          currencies={currencies}
        />
      </div>
    </div>
  );
}

function MemberProfileModal({
  open,
  onClose,
  economyId,
  userId,
  profiles,
  currencies,
}: {
  open: boolean;
  onClose: () => void;
  economyId: string;
  userId: string;
  profiles: Record<string, string>;
  currencies: { id: string; name: string; symbol: string; color: string }[];
}) {
  const [bio, setBio] = useState<string>('');
  const [balances, setBalances] = useState<{ currency_id: string; balance: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [isMe, setIsMe] = useState(false);

  useEffect(() => {
    if (!open || !economyId || !userId) return;

    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const meId = s.session?.user?.id;
      setIsMe(meId === userId);

      const { data: p, error: e1 } = await supabase.from('profiles').select('bio').eq('user_id', userId).maybeSingle();
      if (e1) return alert(e1.message);
      setBio((p?.bio as string) ?? '');

      const { data: b, error: e2 } = await supabase
        .from('currency_balances_by_user')
        .select('currency_id, balance')
        .eq('economy_id', economyId)
        .eq('user_id', userId);
      if (e2) return alert(e2.message);
      setBalances((b ?? []).map((r: any) => ({ currency_id: r.currency_id, balance: Number(r.balance) })));

      const { data: a, error: e3 } = await supabase
        .from('activities')
        .select('id, currency_id, points, description, created_at')
        .eq('economy_id', economyId)
        .eq('created_by', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (e3) return alert(e3.message);
      setRecent((a ?? []).map((x: any) => ({ ...x, points: Number(x.points) })));
    })();
  }, [open, economyId, userId]);

  async function saveBio() {
    if (!isMe) return;
    const text = bio ?? '';
    const { error } = await supabase
      .from('profiles')
      .update({ bio: text, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) return alert(error.message);
    alert('保存しました');
  }

  function cLabel(cid: string) {
    const c = currencies.find((x) => x.id === cid);
    return c ? `${c.name} (${c.symbol})` : cid.slice(0, 6);
  }
  function cColor(cid: string) {
    return currencies.find((x) => x.id === cid)?.color ?? '#64748b';
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold">
              {profiles[userId] ?? userId.slice(0, 6)}
              <span className="text-slate-400 text-sm ml-2 font-mono">{userId.slice(0, 8)}…</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">メンバープロフィール</div>
          </div>

          <button onClick={onClose} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm">
            閉じる
          </button>
        </div>

        <div className="mt-5">
          <div className="text-sm font-semibold text-slate-200 mb-2">コメント</div>
          <textarea
            className="w-full min-h-[90px] p-3 rounded bg-slate-800 border border-slate-700 outline-none focus:border-purple-500"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="自己紹介 / メモ（本人のみ編集可能）"
            readOnly={!isMe}
          />
          {isMe && (
            <button onClick={saveBio} className="mt-2 px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 font-semibold text-sm">
              コメント保存
            </button>
          )}
          {!isMe && <div className="text-xs text-slate-500 mt-2">※他人のコメントは編集できません</div>}
        </div>

        <div className="mt-6">
          <div className="text-sm font-semibold text-slate-200 mb-2">残高（この人の財布）</div>
          <div className="space-y-2">
            {balances.map((b) => (
              <div key={b.currency_id} className="flex items-center justify-between p-3 rounded bg-slate-800/70">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cColor(b.currency_id) }} />
                  <div className="text-sm">{cLabel(b.currency_id)}</div>
                </div>
                <div className="font-mono">{Number(b.balance).toFixed(2)}</div>
              </div>
            ))}
            {balances.length === 0 && <div className="text-slate-400 text-sm">まだ残高がありません</div>}
          </div>
        </div>

        <div className="mt-6">
          <div className="text-sm font-semibold text-slate-200 mb-2">最近の活動（この人）</div>
          <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
            {recent.map((a) => (
              <div key={a.id} className="p-3 rounded bg-slate-800/60">
                <div className="text-sm">{a.description}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {new Date(a.created_at).toLocaleString('ja-JP')} / {cLabel(a.currency_id)}
                  <span className="ml-2 text-green-400 font-semibold">+{Number(a.points).toFixed(2)}</span>
                </div>
              </div>
            ))}
            {recent.length === 0 && <div className="text-slate-400 text-sm">まだ活動がありません</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
