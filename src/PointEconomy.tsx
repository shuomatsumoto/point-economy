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
  status: string; // enum exchange_status の値
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

type Props = { economyId: string };

export default function PointEconomy({ economyId }: Props) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'currencies' | 'activities' | 'exchange'>('dashboard');

  const [me, setMe] = useState<{ id: string; email?: string } | null>(null);

  const [profiles, setProfiles] = useState<Record<string, string>>({}); // user_id -> display_name

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  // 財布（残高）: currency_id -> balance
  const [balances, setBalances] = useState<Record<string, number>>({});

  // 作成フォーム
  const [newCurrency, setNewCurrency] = useState({ name: '', symbol: '', rules: '', color: '#3b82f6' });
  const [newActivity, setNewActivity] = useState({ currencyId: '', description: '', points: '' });

  // Exchange
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

  // ---------------------------
  // Loaders
  // ---------------------------
  async function loadMe() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      alert(error.message);
      return;
    }
    const u = data.session?.user;
    setMe(u ? { id: u.id, email: u.email ?? undefined } : null);
  }

  async function loadProfiles() {
    const { data, error } = await supabase.from('profiles').select('user_id, display_name');
    if (error) return alert(error.message);
    const m: Record<string, string> = {};
    (data ?? []).forEach((p: any) => (m[p.user_id] = p.display_name || p.user_id.slice(0, 6)));
    setProfiles(m);
  }

  async function loadCurrencies() {
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('economy_id', economyId)
      .order('created_at', { ascending: true });

    if (error) return alert(error.message);
    setCurrencies((data ?? []) as Currency[]);
  }

  async function loadActivities() {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('economy_id', economyId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return alert(error.message);

    // points が string の環境もあるので Number化
    const rows = (data ?? []).map((a: any) => ({
      ...a,
      points: Number(a.points),
    })) as Activity[];
    setActivities(rows);
  }

  async function loadBalances() {
    // ユーザー別財布：view currency_balances_by_user を読む
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

  // 初期ロード
  useEffect(() => {
    if (!economyId) return;
    (async () => {
      await loadMe();
      await Promise.all([loadProfiles(), loadCurrencies(), loadActivities(), loadBalances(), loadRequests()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [economyId]);

  // request 選択が変わったら rates をロード
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

  const totalValue = useMemo(() => {
    // 同一単位ではないが、UI上の「総数」指標として財布合計を出す
    return Object.values(balances).reduce((s, v) => s + Number(v), 0);
  }, [balances]);

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
    const pointsStr = newActivity.points;

    if (!currencyId || !description || !pointsStr) return;

    const pts = Number(pointsStr);
    if (!Number.isFinite(pts)) return;

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
    await Promise.all([loadActivities(), loadBalances()]);
  }

  async function createRequest() {
    const fromId = newRequest.fromId;
    const toId = newRequest.toId;
    const amt = Number(newRequest.amount);

    if (!fromId || !toId || !Number.isFinite(amt) || amt <= 0) return;
    if (fromId === toId) return alert('交換元と交換先は別にしてください');

    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return alert('not authenticated');

    // 自分財布の残高チェック（view基準）
    if (myBalance(fromId) < amt) return alert('残高不足です');

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
    if (!myRate) return;

    const rate = Number(myRate);
    if (!Number.isFinite(rate) || rate <= 0) return alert('rate を正しく入力してください');

    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return alert('not authenticated');

    // unique(request_id, submitted_by) を前提に upsert
    const { error } = await supabase.from('exchange_rate_submissions').upsert(
      {
        economy_id: selectedRequest.economy_id,
        request_id: selectedRequest.id,
        submitted_by: uid,
        rate,
      },
      { onConflict: 'request_id,submitted_by' }
    );

    if (error) return alert(error.message);

    setMyRate('');
    await loadRateSubmissions(selectedRequest.id);
  }

  async function finalizeSelected() {
    if (!selectedRequest) return;

    const { data, error } = await supabase.rpc('finalize_exchange_request', { p_request_id: selectedRequest.id });

    if (error) return alert(error.message);

    // finalize 成功後に refresh
    await Promise.all([loadRequests(), loadBalances()]);
    // data は exchange_id の想定だが表示は任意
    console.log('finalized exchange id:', data);
  }

  // ---------------------------
  // UI
  // ---------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-4xl font-bold mb-1 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            マイナー資本主義
          </h1>
          <p className="text-slate-300 text-sm">
            economy: <span className="font-mono">{economyId}</span>
            {me ? (
              <>
                {' '}
                / user: <span className="font-semibold">{who(me.id)}</span>
              </>
            ) : null}
          </p>
        </header>

        <nav className="flex flex-wrap gap-2 mb-6 bg-slate-800/50 p-2 rounded-lg backdrop-blur">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'ダッシュボード' },
            { id: 'currencies', icon: TrendingUp, label: 'ポイント銘柄' },
            { id: 'activities', icon: CheckCircle, label: '活動記録' },
            { id: 'exchange', icon: ArrowRightLeft, label: '交換' },
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
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp size={24} />
                  保有ポイント（自分）
                </h2>
                <button
                  onClick={loadBalances}
                  className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                >
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

            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <h2 className="text-xl font-bold mb-4">最近の活動（全体）</h2>
              <div className="space-y-2">
                {activities.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex justify-between items-center p-3 bg-slate-700/30 rounded">
                    <div>
                      <div className="text-sm">{a.description}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(a.created_at).toLocaleString('ja-JP')} / {who(a.created_by)} / {cLabel(a.currency_id)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">+{Number(a.points).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && <p className="text-slate-400 text-center py-8">まだ活動記録がありません</p>}
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
                  placeholder="銘柄名（例：哲学書ポイント）"
                  value={newCurrency.name}
                  onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="シンボル（例：PHIL）"
                  value={newCurrency.symbol}
                  onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />
                <textarea
                  placeholder="獲得ルール（例：30分読書で10pt）"
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
                {currencies.map((currency) => (
                  <div key={currency.id} className="p-4 bg-slate-700/50 rounded">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: currency.color }} />
                      <div className="font-bold text-lg">{currency.name}</div>
                      <div className="text-slate-400">({currency.symbol})</div>
                    </div>
                    {currency.rules && (
                      <div className="text-sm text-slate-300 mt-2 p-3 bg-slate-800/50 rounded">
                        <div className="font-semibold text-slate-400 mb-1">獲得ルール:</div>
                        {currency.rules}
                      </div>
                    )}
                  </div>
                ))}
                {currencies.length === 0 && <p className="text-slate-400 text-center py-8">まだ銘柄がありません</p>}
              </div>
            </div>
          </div>
        )}

        {/* Activities */}
        {activeTab === 'activities' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <CheckCircle size={24} />
                活動を記録してポイント獲得（自分財布）
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

                <input
                  type="text"
                  placeholder="活動内容（例：英語30分）"
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />

                <input
                  type="number"
                  step="0.01"
                  placeholder="獲得ポイント"
                  value={newActivity.points}
                  onChange={(e) => setNewActivity({ ...newActivity, points: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />

                <button onClick={addActivity} className="w-full bg-green-600 hover:bg-green-700 p-3 rounded font-semibold">
                  記録する
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">活動履歴（全体）</h2>
                <button
                  onClick={async () => {
                    await Promise.all([loadActivities(), loadBalances()]);
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
                          {new Date(a.created_at).toLocaleString('ja-JP')} / {who(a.created_by)} / {cLabel(a.currency_id)}
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

        {/* Exchange */}
        {activeTab === 'exchange' && (
          <div className="space-y-6">
            {/* Create request */}
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ArrowRightLeft size={24} />
                交換リクエスト作成（自分財布）
              </h2>

              <div className="space-y-4">
                <select
                  value={newRequest.fromId}
                  onChange={(e) => setNewRequest({ ...newRequest, fromId: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                >
                  <option value="">交換元ポイント</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (自分残高: {myBalance(c.id).toFixed(2)})
                    </option>
                  ))}
                </select>

                <select
                  value={newRequest.toId}
                  onChange={(e) => setNewRequest({ ...newRequest, toId: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                >
                  <option value="">交換先ポイント</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="0.01"
                  placeholder="交換量（from）"
                  value={newRequest.amount}
                  onChange={(e) => setNewRequest({ ...newRequest, amount: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />

                <button onClick={createRequest} className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded font-semibold">
                  Request作成
                </button>
              </div>
            </div>

            {/* Request list + detail */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* List */}
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
                        selectedRequestId === r.id
                          ? 'bg-purple-700/40 border-purple-500'
                          : 'bg-slate-700/30 border-slate-700 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="text-sm font-semibold">
                        {cById(r.from_currency_id)?.symbol ?? '???'} → {cById(r.to_currency_id)?.symbol ?? '???'}
                      </div>
                      <div className="text-xs text-slate-300 mt-1">
                        amount_from: {Number(r.amount_from).toFixed(2)} / status: {r.status} / by: {who(r.created_by)}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{new Date(r.created_at).toLocaleString('ja-JP')}</div>
                    </button>
                  ))}
                  {requests.length === 0 && <p className="text-slate-400 text-center py-8">まだrequestがありません</p>}
                </div>
              </div>

              {/* Detail */}
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
                        by {who(selectedRequest.created_by)} / {new Date(selectedRequest.created_at).toLocaleString('ja-JP')}
                      </div>
                      {selectedRequest.status === 'finalized' && (
                        <div className="text-xs text-slate-200 mt-2">
                          final_rate: {selectedRequest.final_rate ?? '—'} / amount_to: {selectedRequest.amount_to ?? '—'}
                        </div>
                      )}
                    </div>

                    {/* SubmitRate */}
                    <div className="p-4 bg-slate-700/30 rounded">
                      <div className="font-semibold mb-2">SubmitRate</div>

                      <input
                        type="number"
                        step="0.000001"
                        placeholder="rate（例：2.0）"
                        value={myRate}
                        onChange={(e) => setMyRate(e.target.value)}
                        className="w-full p-3 bg-slate-800 rounded border border-slate-600 focus:border-purple-500 outline-none"
                      />

                      <button
                        onClick={submitRate}
                        className="w-full mt-3 bg-green-600 hover:bg-green-700 p-3 rounded font-semibold"
                      >
                        レート提出
                      </button>

                      <button
                        onClick={finalizeSelected}
                        className="w-full mt-3 bg-purple-600 hover:bg-purple-700 p-3 rounded font-semibold"
                      >
                        Finalize（平均で確定）
                      </button>
                    </div>

                    {/* Rates */}
                    <div className="p-4 bg-slate-700/20 rounded">
                      <div className="font-semibold mb-2">
                        提出済みレート{avgRate != null ? `（平均: ${avgRate.toFixed(6)}）` : ''}
                      </div>

                      <div className="space-y-2">
                        {rateSubmissions.map((s) => (
                          <div key={s.id} className="flex items-center justify-between p-3 bg-slate-800/60 rounded">
                            <div className="text-sm">{who(s.submitted_by)}</div>
                            <div className="font-mono text-sm">{Number(s.rate).toFixed(6)}</div>
                          </div>
                        ))}
                        {rateSubmissions.length === 0 && <div className="text-slate-300">まだ提出がありません</div>}
                      </div>
                    </div>

                    <div className="text-xs text-slate-400">
                      ※ finalize 後の残高反映は「自分財布」に対して行われます（currency_balances_by_user）。
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-slate-400">
          profiles が見えない/名前が出ない場合は、profiles テーブル作成と schema cache 更新、activities.created_by の存在を確認してください。
        </footer>
      </div>
    </div>
  );
}
