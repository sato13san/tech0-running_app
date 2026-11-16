// app/page.tsx — Giftia 検索画面（2週目・穴埋め版）
// 【穴7】【穴8】を、対応表と公式ドキュメントを頼りに自分で埋める。
// 答えは 配布コード/答え合わせ/frontend/page.tsx（自分で埋めてから見る）。
// 1週目との違い：①searchGifts が FastAPI を呼ぶ（async/await）②入力した条件を渡す ③つながらないときの表示
"use client"; // ← ブラウザで動く合図。useState や onClick を使う画面に必要

import { useState, useEffect, useRef } from "react";
import ResultCard from "./ResultCard";
import { searchGifts, getLifeScenes, type Gift, type LifeScene, type SearchCondition } from "@/lib/api";

export default function Home() {
  // ① 状態（変化するデータ）を覚える箱
  const [mode, setMode] = useState<"standard" | "business">("standard"); // どのタブか
  const [keyword, setKeyword] = useState("");                             // 入力した言葉
  const [category, setCategory] = useState("");                           // 選んだカテゴリー
  const [indivWrap, setIndivWrap] = useState(false); // 個包装だけ（取引先へのお礼）
  const [priceBand, setPriceBand] = useState("");                         // 価格帯（取引先へのお礼）
  const [results, setResults] = useState<Gift[] | null>(null);            // 検索結果
  const [error, setError] = useState("");                                 // つながらないときの文言


  const [scenes, setScenes] = useState<LifeScene[]>([]);
  const [sceneError, setSceneError] = useState("");
  const [sceneLoading, setSceneLoading] = useState(true);
  const [lifeSceneIds, setLifeSceneIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(0);
  const [applied, setApplied] = useState("");
  const requestId = useRef(0);
  const [sizeFree, setSizeFree] = useState(false);
  async function loadScenes() {
    setSceneLoading(true);
    setSceneError("");
    try { setScenes(await getLifeScenes()); }
    catch { setSceneError("生活シーンを取得できません。再取得してください。"); }
    finally { setSceneLoading(false); }
  }
  useEffect(() => { void loadScenes(); }, []);
  function changeMode(next: "standard" | "business") {
    requestId.current += 1; // Discard a response from the previous tab.
    setMode(next); setResults(null); setError(""); setBusy(false);
  }
  async function runSearch(condition: SearchCondition) {
    const id = ++requestId.current;
    setError(""); setBusy(true); setResults(null);
    // Build labels NOW so editing inputs while awaiting cannot relabel old results.
    const labels = [condition.keyword, condition.category,
      condition.indivWrap ? "個包装" : "",
      condition.priceBand === "3000" ? "3,000円以上5,000円未満" : "",
      condition.priceBand === "5000" ? "5,000円以上10,000円未満" : "",
      ...(condition.lifeSceneIds ?? []).map(x => scenes.find(s => s.id === x)?.name ?? x),
      condition.sizeFree ? "サイズ選び不要" : "",
    ].filter(Boolean).join(" ／ ") || "指定なし";
    try {
      const data = await searchGifts(condition);
      if (id !== requestId.current) return;
      setResults(data.results); setTotal(data.total); setApplied(labels);
      // EXTRA_RESULT
    } catch (err) {
      if (id !== requestId.current) return;
      setResults(null); setError(`検索できませんでした。条件を確認して再試行してください：${(err as Error).message}`);
    } finally { if (id === requestId.current) setBusy(false); }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    // EXTRA_VALIDATION
    const condition: SearchCondition = mode === "standard"
      ? { keyword, category, indivWrap: false, priceBand: "", lifeSceneIds }
      : { keyword: "", category: "", indivWrap, priceBand, lifeSceneIds: [] };
    if (mode === "standard") condition.sizeFree = sizeFree;
    await runSearch(condition);
  }

  return (
    <main className="page">
      <header className="header"><h1>Giftia</h1></header>

      {/* タブ：state(mode)＋条件で出し分ける */}
      <nav className="modes">
        <button className={mode === "standard" ? "on" : ""} onClick={() => changeMode("standard")}>いまの検索</button>
        <button className={mode === "business" ? "on" : ""} onClick={() => changeMode("business")}>取引先へのお礼</button>
      </nav>

      <form className="form" onSubmit={onSearch}>
        {mode === "standard" ? (
          <>

            <fieldset className="life-scenes" disabled={sceneLoading}>
              <legend>贈る相手の生活シーン（複数選択可）</legend>
              {scenes.map(s => <label className="chk" key={s.id}>
                <input type="checkbox" checked={lifeSceneIds.includes(s.id)}
                  onChange={e => setLifeSceneIds(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id))} />
                {s.name}
              </label>)}
              {sceneLoading && <span>選択肢を取得中…</span>}
            </fieldset>
            {sceneError && <p role="alert">{sceneError}<button type="button" onClick={() => void loadScenes()}>再取得</button></p>}
            <label className="chk"><input type="checkbox" checked={sizeFree} onChange={e => setSizeFree(e.target.checked)} />サイズ選び不要</label>
            <input className="q" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="キーワード（例：送別 お菓子）" />
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">すべてのカテゴリー</option>
              <option value="コスメ">コスメ</option>
              <option value="食品">食品</option>
              <option value="生活雑貨">生活雑貨</option>
            </select>
          </>
        ) : (
          <>
            <label className="chk"><input type="checkbox" checked={indivWrap} onChange={(e) => setIndivWrap(e.target.checked)} /> 個包装</label>
            <select value={priceBand} onChange={(e) => setPriceBand(e.target.value)}>
              <option value="">すべての価格帯</option>
              <option value="3000">3,000〜5,000円</option>
              <option value="5000">5,000〜10,000円</option>
            </select>
          </>
        )}
        <button type="submit" disabled={busy}>{busy ? "検索中…" : "検索"}</button>
      </form>

      {error && <p className="summary" role="alert">{error}</p>}

      {/* 結果：同じ ResultCard を map で並べる（使い回し） */}
      {results && (
        <section>
          <p className="summary">適用条件：{applied}</p>
          <p className="summary" aria-live="polite">該当 {total} 件 ／ 上位 {results.length} 件</p>
          {total === 0 && <p>条件に合う商品が見つかりませんでした。</p>}
          {/* EXTRA_EMPTY */}
          <div className="grid">
            {results.map((g, i) => <ResultCard key={g.id} gift={g} rank={i + 1} />)}
          </div>
        </section>
      )}
    </main>
  );
}