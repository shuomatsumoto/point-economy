import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabaseClient';

type CurrencyRow = {
  id: string;
  economy_id: string;
  name: string;
  symbol: string;
  rules: string | null;
  color: string;
  created_at: string;
};

type BalanceRow = {
  economy_id: string;
  currency_id: string;
  balance: number;
};

type ActivityRow = {
  id: string;
  economy_id: string;
  currency_id: string;
  description: string;
  points: number;
  created_by: string;
  created_at: string;
};

type ExchangeRequestRow = {
  id: string;
  economy_id: string;
  from_currency_id: string;
  to_currency_id: string;
  amount_from: number;
  status: 'open' | 'finalized' | 'cancelled';
  created_by: string;
  created_at: string;
  finalized_at: string | null;
  final_rate: number | null;
  amount_to: number | null;
};

type RateSubmissionRow = {
  id: string;
  economy_id: string;
  request_id: string;
  submitted_by: string;
  rate: number;
  created_at: string;
};

export default function PointEconomy({ economyId }: { economyId: string }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'currencies' | 'activities' | 'exchange'>('dashboard');

  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});

  const [activities, setActivities] = useState<ActivityRow[]>([]);

  const [requests, setRequests] = useState<ExchangeRequestRow[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const selectedRequest = useMemo(
    () => requests.find(r => r.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  );
  const [submissions, setSubmissions] = useState<RateSubmissionRow[]>([]);

  const [newCurrency, setNewCurrency] = useState({ name: '', symbol: '', rules: '', color: '#3b82f6' });
  const [newActivity, setNewActivity] = useState({ currencyId: '', description: '', points: '' });

  const [newRequest, setNewRequest] = useState({ fromId: '', toId: '', amount: '' });
  const [newRate, setNewRate] = useState({ rate: '' });

  const currencyById = useMemo(() => {
    const m = new Map<string, CurrencyRow>();
    currencies.forEach(c => m.set(c.id, c));
    return m;
  }, [currencies]);

  const totalValue = useMemo(() => {
    return Object.values(balances).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  }, [balances]);

  const [profiles, setProfiles] = useState<Record<string, string>>({});

  async function loadProfiles() {
    const { data, error } = await supabase.from('profiles').select('user_id,display_name');
    if (error) return alert(error.message);
    const m: Record<string, string> = {};
    (data ?? []).forEach((p: any) => (m[p.user_id] = p.display_name || p.user_id.slice(0, 6)));
    setProfiles(m);
  }

  const [activityScope, setActivityScope] = useState<'mine'|'all'>('all');

  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user?.id;
  const visible = activityScope === 'mine'
  ? activities.filter(a => a.created_by === uid)
  : activities;

  <div className="flex gap-2 mb-3">
  <button onClick={() => setActivityScope('all')} className={`px-3 py-2 rounded ${activityScope==='all'?'bg-purple-600':'bg-slate-700'}`}>全体</button>
  <button onClick={() => setActivityScope('mine')} className={`px-3 py-2 rounded ${activityScope==='mine'?'bg-purple-600':'bg-slate-700'}`}>自分</button>
  </div>
  <div className="text-xs text-slate-300">
  {profiles[activity.created_by] ?? activity.created_by.slice(0,6)}
  </div>


  function symbol(id: string) {
    return currencyById.get(id)?.symbol || '';
  }
  function name(id: string) {
    return currencyById.get(id)?.name || '';
  }
  function bal(id: string) {
    return balances[id] ?? 0;
  }

  async function loadCurrencies() {
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('economy_id', economyId)
      .order('created_at', { ascending: true });
    if (error) return alert(error.message);
    setCurrencies((data ?? []) as CurrencyRow[]);
  }

  async function loadBalances() {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user?.id;
  if (!uid) return;

  const { data, error } = await supabase
    .from('currency_balances_by_user')
    .select('economy_id,user_id,currency_id,balance')
    .eq('economy_id', economyId)
    .eq('user_id', uid);

  if (error) return alert(error.message);

  const map: Record<string, number> = {};
  (data ?? []).forEach((r: any) => { map[r.currency_id] = Number(r.balance); });
  setBalances(map);
}

  async function loadActivities() {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('economy_id', economyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return alert(error.message);
    setActivities((data ?? []) as ActivityRow[]);
  }

  async function loadRequests() {
    const { data, error } = await supabase
      .from('exchange_requests')
      .select('*')
      .eq('economy_id', economyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return alert(error.message);
    setRequests((data ?? []) as ExchangeRequestRow[]);
  }

  async function loadSubmissions(requestId: string) {
    const { data, error } = await supabase
      .from('exchange_rate_submissions')
      .select('*')
      .eq('economy_id', economyId)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });
    if (error) return alert(error.message);
    setSubmissions((data ?? []) as RateSubmissionRow[]);
  }

  useEffect(() => {
    if (!economyId) return;
    loadCurrencies();
    loadBalances();
    loadActivities();
    loadRequests();
    setSelectedRequestId('');
    setSubmissions([]);
  }, [economyId]);

  useEffect(() => {
    if (!selectedRequestId) return;
    loadSubmissions(selectedRequestId);
  }, [selectedRequestId]);

  const addCurrency = async () => {
    if (!newCurrency.name || !newCurrency.symbol) return;

    const { error } = await supabase.from('currencies').insert({
      economy_id: economyId,
      name: newCurrency.name,
      symbol: newCurrency.symbol,
      rules: newCurrency.rules || null,
      color: newCurrency.color,
    });
    if (error) return alert(error.message);

    setNewCurrency({ name: '', symbol: '', rules: '', color: '#3b82f6' });
    await loadCurrencies();
  };

  const addActivity = async () => {
    if (!newActivity.currencyId || !newActivity.description || !newActivity.points) return;
    const points = Number(newActivity.points);
    if (!Number.isFinite(points)) return;

    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return alert('not logged in');

    const { error } = await supabase.from('activities').insert({
      economy_id: economyId,
      currency_id: newActivity.currencyId,
      description: newActivity.description,
      points,
      created_by: uid,
    });
    if (error) return alert(error.message);

    setNewActivity({ currencyId: '', description: '', points: '' });
    await loadActivities();
    await loadBalances();
  };

  const createRequest = async () => {
    if (!newRequest.fromId || !newRequest.toId || !newRequest.amount) return;
    const amount = Number(newRequest.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return alert('not logged in');

    if (bal(newRequest.fromId) < amount) return alert('残高不足');

    const { error } = await supabase.from('exchange_requests').insert({
      economy_id: economyId,
      from_currency_id: newRequest.fromId,
      to_currency_id: newRequest.toId,
      amount_from: amount,
      created_by: uid,
      status: 'open',
    });
    if (error) return alert(error.message);

    setNewRequest({ fromId: '', toId: '', amount: '' });
    await loadRequests();
  };

  const submitRate = async () => {
    if (!selectedRequest) return;
    if (selectedRequest.status !== 'open') return;
    if (!newRate.rate) return;

    const rate = Number(newRate.rate);
    if (!Number.isFinite(rate) || rate <= 0) return;

    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return alert('not logged in');

    const { error } = await supabase.from('exchange_rate_submissions').insert({
      economy_id: economyId,
      request_id: selectedRequest.id,
      submitted_by: uid,
      rate,
    });
    if (error) return alert(error.message);

    setNewRate({ rate: '' });
    await loadSubmissions(selectedRequest.id);
  };

  const finalizeSelected = async () => {
    if (!selectedRequest) return;
    if (selectedRequest.status !== 'open') return;

    const { error } = await supabase.rpc('finalize_exchange_request', { p_request_id: selectedRequest.id });
    if (error) return alert(error.message);

    await loadRequests();
    await loadBalances();
    await loadSubmissions(selectedRequest.id);
  };

  const avgRate = useMemo(() => {
    if (submissions.length === 0) return null;
    const sum = submissions.reduce((s, r) => s + Number(r.rate), 0);
    return sum / submissions.length;
  }, [submissions]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <div className="text-slate-300 text-sm">economyId: {economyId}</div>
          <h1 className="text-3xl font-bold">マイナー資本主義</h1>
        </header>

        <nav className="flex gap-2 mb-6 bg-slate-800/60 p-2 rounded">
          {[
            { id: 'dashboard', label: 'ダッシュボード' },
            { id: 'currencies', label: 'ポイント銘柄' },
            { id: 'activities', label: '活動記録' },
            { id: 'exchange', label: '交換（合意制）' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-4 py-2 rounded ${activeTab === t.id ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/60 p-5 rounded border border-slate-700">
              <div className="text-slate-400 text-sm">総ポイント数（残高合計）</div>
              <div className="text-3xl font-bold">{totalValue.toFixed(2)}</div>
            </div>
            <div className="bg-slate-800/60 p-5 rounded border border-slate-700">
              <div className="text-slate-400 text-sm">銘柄数</div>
              <div className="text-3xl font-bold">{currencies.length}</div>
            </div>
            <div className="bg-slate-800/60 p-5 rounded border border-slate-700">
              <div className="text-slate-400 text-sm">活動数</div>
              <div className="text-3xl font-bold">{activities.length}</div>
            </div>

            <div className="md:col-span-3 bg-slate-800/60 p-5 rounded border border-slate-700">
              <div className="font-semibold mb-3">保有ポイント（残高）</div>
              <div className="space-y-2">
                {currencies.map(c => (
                  <div key={c.id} className="flex justify-between bg-slate-700/60 p-3 rounded">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-slate-300 text-sm">{c.symbol}</div>
                    </div>
                    <div className="text-2xl font-bold">{bal(c.id).toFixed(2)}</div>
                  </div>
                ))}
                {currencies.length === 0 && <div className="text-slate-300">通貨がありません</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'currencies' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/60 p-5 rounded border border-slate-700">
              <div className="font-semibold mb-3">新規銘柄</div>
              <div className="grid gap-2">
                <input className="p-3 rounded bg-slate-700" placeholder="name" value={newCurrency.name}
                  onChange={e => setNewCurrency({ ...newCurrency, name: e.target.value })} />
                <input className="p-3 rounded bg-slate-700" placeholder="symbol" value={newCurrency.symbol}
                  onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })} />
                <textarea className="p-3 rounded bg-slate-700" placeholder="rules" value={newCurrency.rules}
                  onChange={e => setNewCurrency({ ...newCurrency, rules: e.target.value })} />
                <button onClick={addCurrency} className="p-3 rounded bg-purple-600 hover:bg-purple-500 font-semibold">
                  作成
                </button>
              </div>
            </div>

            <div className="bg-slate-800/60 p-5 rounded border border-slate-700">
              <div className="font-semibold mb-3">銘柄一覧</div>
              <div className="space-y-2">
                {currencies.map(c => (
                  <div key={c.id} className="p-3 rounded bg-slate-700/60">
                    <div className="font-semibold">{c.name} <span className="text-slate-300">({c.symbol})</span></div>
                    {c.rules && <div className="text-slate-300 text-sm mt-1">{c.rules}</div>}
                  </div>
                ))}
                {currencies.length === 0 && <div className="text-slate-300">なし</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/60 p-5 rounded border border-slate-700">
              <div className="font-semibold mb-3">活動を記録</div>
              <div className="grid gap-2">
                <select className="p-3 rounded bg-slate-700"
                  value={newActivity.currencyId}
                  onChange={e => setNewActivity({ ...newActivity, currencyId: e.target.value })}>
                  <option value="">通貨を選択</option>
                  {currencies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>)}
                </select>
                <input className="p-3 rounded bg-slate-700" placeholder="description"
                  value={newActivity.description}
                  onChange={e => setNewActivity({ ...newActivity, description: e.target.value })} />
                <input className="p-3 rounded bg-slate-700" placeholder="points"
                  type="number"
                  value={newActivity.points}
                  onChange={e => setNewActivity({ ...newActivity, points: e.target.value })} />
                <button onClick={addActivity} className="p-3 rounded bg-green-600 hover:bg-green-500 font-semibold">
                  記録
                </button>
              </div>
            </div>

            <div className="bg-slate-800/60 p-5 rounded border border-slate-700">
              <div className="font-semibold mb-3">履歴</div>
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {activities.map(a => (
                  <div key={a.id} className="p-3 rounded bg-slate-700/60">
                    <div className="font-semibold">{a.description}</div>
                    <div className="text-slate-300 text-sm">
                      +{Number(a.points).toFixed(2)} {symbol(a.currency_id)} / {new Date(a.created_at).toLocaleString('ja-JP')}
                    </div>
                  </div>
                ))}
                {activities.length === 0 && <div className="text-slate-300">なし</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'exchange' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 bg-slate-800/60 p-5 rounded border border-slate-700">
              <div className="font-semibold mb-3">RequestList</div>
              <button onClick={loadRequests} className="mb-3 px-3 py-2 rounded bg-slate-700 hover:bg-slate-600">
                更新
              </button>
              <div className="space-y-2 max-h-[55vh] overflow-auto">
                {requests.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRequestId(r.id)}
                    className={`w-full text-left p-3 rounded ${selectedRequestId === r.id ? 'bg-purple-700' : 'bg-slate-700/60 hover:bg-slate-700'}`}
                  >
                    <div className="font-semibold">
                      {symbol(r.from_currency_id)} → {symbol(r.to_currency_id)} / {Number(r.amount_from).toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-300">
                      {r.status} / {new Date(r.created_at).toLocaleString('ja-JP')}
                    </div>
                  </button>
                ))}
                {requests.length === 0 && <div className="text-slate-300">リクエストなし</div>}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-800/60 p-5 rounded border border-slate-700">
                <div className="font-semibold mb-3">新規リクエスト</div>
                <div className="grid md:grid-cols-4 gap-2">
                  <select className="p-3 rounded bg-slate-700"
                    value={newRequest.fromId}
                    onChange={e => setNewRequest({ ...newRequest, fromId: e.target.value })}>
                    <option value="">from</option>
                    {currencies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.symbol} (残高 {bal(c.id).toFixed(2)})
                      </option>
                    ))}
                  </select>

                  <select className="p-3 rounded bg-slate-700"
                    value={newRequest.toId}
                    onChange={e => setNewRequest({ ...newRequest, toId: e.target.value })}>
                    <option value="">to</option>
                    {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
                  </select>

                  <input className="p-3 rounded bg-slate-700" placeholder="amount"
                    type="number"
                    value={newRequest.amount}
                    onChange={e => setNewRequest({ ...newRequest, amount: e.target.value })} />

                  <button onClick={createRequest} className="p-3 rounded bg-blue-600 hover:bg-blue-500 font-semibold">
                    Request作成
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/60 p-5 rounded border border-slate-700">
                <div className="font-semibold mb-3">RequestDetail</div>

                {!selectedRequest && <div className="text-slate-300">左のリストから選択してください</div>}

                {selectedRequest && (
                  <>
                    <div className="text-slate-200">
                      <div className="font-semibold">
                        {name(selectedRequest.from_currency_id)} ({symbol(selectedRequest.from_currency_id)}) →
                        {name(selectedRequest.to_currency_id)} ({symbol(selectedRequest.to_currency_id)})
                      </div>
                      <div className="text-sm text-slate-300">
                        amount_from: {Number(selectedRequest.amount_from).toFixed(2)} / status: {selectedRequest.status}
                      </div>
                      {selectedRequest.status === 'finalized' && (
                        <div className="text-sm text-slate-300 mt-2">
                          final_rate(avg): {Number(selectedRequest.final_rate).toFixed(6)} /
                          amount_to: {Number(selectedRequest.amount_to).toFixed(2)} /
                          finalized_at: {selectedRequest.finalized_at ? new Date(selectedRequest.finalized_at).toLocaleString('ja-JP') : '-'}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid md:grid-cols-3 gap-2 items-end">
                      <div className="md:col-span-1">
                        <div className="text-sm text-slate-300 mb-1">SubmitRate</div>
                        <input className="w-full p-3 rounded bg-slate-700" placeholder="rate"
                          type="number" step="0.000001"
                          value={newRate.rate}
                          onChange={e => setNewRate({ rate: e.target.value })} />
                      </div>

                      <button
                        disabled={selectedRequest.status !== 'open'}
                        onClick={submitRate}
                        className={`p-3 rounded font-semibold ${selectedRequest.status === 'open' ? 'bg-green-600 hover:bg-green-500' : 'bg-slate-700 cursor-not-allowed'}`}
                      >
                        レート提出
                      </button>

                      <button
                        disabled={selectedRequest.status !== 'open'}
                        onClick={finalizeSelected}
                        className={`p-3 rounded font-semibold ${selectedRequest.status === 'open' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-slate-700 cursor-not-allowed'}`}
                      >
                        Finalize（平均で確定）
                      </button>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm text-slate-300 mb-2">
                        提出済みレート（平均: {avgRate === null ? '-' : avgRate.toFixed(6)}）
                      </div>
                      <div className="space-y-2">
                        {submissions.map(s => (
                          <div key={s.id} className="p-3 rounded bg-slate-700/60 flex justify-between">
                            <div className="text-slate-200">{Number(s.rate).toFixed(6)}</div>
                            <div className="text-xs text-slate-300">{new Date(s.created_at).toLocaleString('ja-JP')}</div>
                          </div>
                        ))}
                        {submissions.length === 0 && <div className="text-slate-300">まだ提出なし</div>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-2 flex-wrap">
          <button onClick={loadCurrencies} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700">通貨再読込</button>
          <button onClick={loadActivities} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700">活動再読込</button>
          <button onClick={loadBalances} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700">残高再計算</button>
          <button onClick={loadRequests} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700">交換再読込</button>
        </div>
      </div>
    </div>
  );
}
