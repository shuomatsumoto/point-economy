import React from 'react';
import { supabase } from './lib/supabaseClient';
import PointEconomy from './PointEconomy';

function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<any>(null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');

  React.useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session);
    if (data.session) ensureProfile();
  });

  const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
    setSession(s);
    if (s) ensureProfile();
  });

  return () => sub.subscription.unsubscribe();
  }, []);


  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  }

  async function signUp() {
    // display_name を持たせたい場合（任意）
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: email.split('@')[0] },
      },
    });
    if (error) return alert(error.message);
    alert('アカウントを作成しました。メール確認が必要な設定なら、受信メールを確認してください。');
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="w-full max-w-md bg-slate-800 p-6 rounded space-y-3">
          <div className="flex gap-2">
            <button
              className={`flex-1 p-2 rounded ${mode === 'signin' ? 'bg-purple-600' : 'bg-slate-700'}`}
              onClick={() => setMode('signin')}
            >
              ログイン
            </button>
            <button
              className={`flex-1 p-2 rounded ${mode === 'signup' ? 'bg-blue-600' : 'bg-slate-700'}`}
              onClick={() => setMode('signup')}
            >
              新規作成
            </button>
          </div>

          <input
            className="w-full p-3 rounded bg-slate-700"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full p-3 rounded bg-slate-700"
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {mode === 'signin' ? (
            <button onClick={signIn} className="w-full bg-purple-600 p-3 rounded font-semibold">
              ログイン
            </button>
          ) : (
            <button onClick={signUp} className="w-full bg-blue-600 p-3 rounded font-semibold">
              アカウント作成
            </button>
          )}
        </div>
      </div>
    );
  }

　async function ensureProfile() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;

  // 既存確認
  const { data: p, error: e1 } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .eq('user_id', user.id)
    .maybeSingle();

  // テーブル未反映/キャッシュ等で死んでるならここで気づける
  if (e1) {
    console.error(e1);
    alert(e1.message);
    return;
  }

  // 無ければ作成
  if (!p) {
    const display = (user.user_metadata?.display_name as string) || user.email?.split('@')[0] || 'user';
    const { error: e2 } = await supabase.from('profiles').insert({ user_id: user.id, display_name: display });
    if (e2) {
      console.error(e2);
      alert(e2.message);
    }
  }
}

  
  return (
    <div>
      <div className="p-2 bg-slate-900 text-slate-200 text-sm flex justify-end">
        <button onClick={signOut} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600">ログアウト</button>
      </div>
      {children}
    </div>
  );
}

function EconomyPicker({ onSelected }: { onSelected: (economyId: string) => void }) {
  const [economies, setEconomies] = React.useState<any[]>([]);
  const [name, setName] = React.useState('');
  const [joinCode, setJoinCode] = React.useState('');

  async function load() {
    const { data, error } = await supabase.from('economies').select('*').order('created_at', { ascending: false });
    if (error) return alert(error.message);
    setEconomies(data ?? []);
  }

  React.useEffect(() => {
    load();
  }, []);

  async function createEconomy() {
    if (!name.trim()) return;
    const { data, error } = await supabase.rpc('create_economy', { p_name: name.trim() });
    if (error) return alert(error.message);
    const row = (data as any[])[0];
    alert(`作成しました。Join code: ${row.join_code}`);
    setName('');
    await load();
    onSelected(row.economy_id);
  }

  async function joinEconomy() {
    if (!joinCode.trim()) return;
    const { data, error } = await supabase.rpc('join_economy', { p_join_code: joinCode.trim() });
    if (error) return alert(error.message);
    setJoinCode('');
    await load();
    onSelected(String(data));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/80 p-6 rounded border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Economy を選択</h2>
          <button onClick={load} className="mb-3 px-3 py-2 rounded bg-slate-700 hover:bg-slate-600">
            再読み込み
          </button>

          <div className="space-y-2">
            {economies.map((e) => (
              <button
                key={e.id}
                onClick={() => onSelected(e.id)}
                className="w-full text-left p-3 rounded bg-slate-700/60 hover:bg-slate-700"
              >
                <div className="font-semibold">{e.name}</div>
                <div className="text-xs text-slate-300">join_code: {e.join_code}</div>
              </button>
            ))}
            {economies.length === 0 && <div className="text-slate-300">まだ参加中のEconomyがありません</div>}
          </div>
        </div>

        <div className="bg-slate-800/80 p-6 rounded border border-slate-700 space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-3">新規作成（あなたがadmin）</h2>
            <input
              className="w-full p-3 rounded bg-slate-700"
              placeholder="economy名（例：哲学サークル）"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button onClick={createEconomy} className="w-full mt-3 p-3 rounded bg-purple-600 hover:bg-purple-500 font-semibold">
              作成
            </button>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">Join code で参加</h2>
            <input
              className="w-full p-3 rounded bg-slate-700"
              placeholder="join code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button onClick={joinEconomy} className="w-full mt-3 p-3 rounded bg-blue-600 hover:bg-blue-500 font-semibold">
              参加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [economyId, setEconomyId] = React.useState<string>('');

  return (
    <AuthGate>
      {economyId ? <PointEconomy economyId={economyId} /> : <EconomyPicker onSelected={setEconomyId} />}
    </AuthGate>
  );
}
