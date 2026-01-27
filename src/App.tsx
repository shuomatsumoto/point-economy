import React from 'react';
import { supabase } from './lib/supabaseClient';
import PointEconomy from './PointEconomy';

function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<any>(null);
  const [email, setEmail] = React.useState('');

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendMagicLink() {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) alert(error.message);
    else alert('メールを確認してください（Magic Link）');
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="w-full max-w-md bg-slate-800 p-6 rounded">
          <h2 className="text-xl font-bold mb-4">ログイン</h2>
          <input
            className="w-full p-3 rounded bg-slate-700 mb-3"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button onClick={sendMagicLink} className="w-full bg-purple-600 p-3 rounded font-semibold">
            Magic Link を送信
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
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