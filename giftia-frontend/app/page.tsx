// app/page.tsx — Giftia 検索画面（2週目・穴埋め版）
// 【穴7】【穴8】を、対応表と公式ドキュメントを頼りに自分で埋める。
// 答えは 配布コード/答え合わせ/frontend/page.tsx（自分で埋めてから見る）。
// 1週目との違い：①searchGifts が FastAPI を呼ぶ（async/await）②入力した条件を渡す ③つながらないときの表示
"use client"; // ← ブラウザで動く合図。useState や onClick を使う画面に必要

import { useState, useEffect, useRef } from "react";
import ResultCard from "./ResultCard";
import { searchGifts, getLifeScenes, getCategories, type Category, type Gift, type LifeScene, type SearchCondition, type Relaxation } from "@/lib/api";

export default function Home() {
  // ① 状態（変化するデータ）を覚える箱
  const [mode, setMode] = useState<"standard" | "business">("standard"); // どのタブか
  const [keyword, setKeyword] = useState("");                             // 入力した言葉
  const [categoryId, setCategoryId] = useState("");                           // 選んだカテゴリー
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState("");
  async function loadCategories() {
    setCategoryLoading(true); setCategoryError("");
    try { setCategories(await getCategories()); }
    catch { setCategoryError("カテゴリーを取得できません。再取得してください。"); }
    finally { setCategoryLoading(false); }
  }
  // 初期表示時に取得。開発時のStrict ModeではEffectが再実行される場合がある。
  useEffect(() => { void loadCategories(); }, []);
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
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [relaxations, setRelaxations] = useState<Relaxation[]>([]);
  const [logSaved, setLogSaved] = useState(true);
  const sessionKey = useRef("");
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

    const labels = [condition.keyword, condition.categoryId !== undefined
      ? categories.find(c => c.id === condition.categoryId)?.name ?? "カテゴリー"
      : condition.category,
      condition.indivWrap ? "個包装" : "",
      condition.priceBand === "3000" ? "3,000円以上5,000円未満" : "",
      condition.priceBand === "5000" ? "5,000円以上10,000円未満" : "",
      ...(condition.lifeSceneIds ?? []).map(x => scenes.find(s => s.id === x)?.name ?? x),
      condition.sizeFree ? "サイズ選び不要" : "",
      condition.priceMin !== undefined ? `${condition.priceMin.toLocaleString()}円以上` : "",
      condition.priceMax !== undefined ? `${condition.priceMax.toLocaleString()}円以下` : "",
    ].filter(Boolean).join(" ／ ") || "指定なし";
    try {
      const data = await searchGifts(condition);
      if (id !== requestId.current) return;
      setResults(data.results); setTotal(data.total); setApplied(labels);
      setRelaxations(data.relaxations); setLogSaved(data.logSaved !== false);
    } catch (err) {
      if (id !== requestId.current) return;
      setResults(null); setError(`検索できませんでした。条件を確認して再試行してください：${(err as Error).message}`);
    } finally { if (id === requestId.current) setBusy(false); }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "standard" && priceMin !== "" && priceMax !== "" && Number(priceMin) > Number(priceMax)) {
      setError("価格の下限は上限以下にしてください"); return;
    }
    const condition: SearchCondition = mode === "standard"
      ? { keyword, category: "", categoryId: categoryId === "" ? undefined : Number(categoryId), indivWrap: false, priceBand: "", lifeSceneIds }
      : { keyword: "", category: "", indivWrap, priceBand, lifeSceneIds: [] };
    if (mode === "standard") {
      condition.sizeFree = sizeFree;
      condition.priceMin = priceMin === "" ? undefined : Number(priceMin);
      condition.priceMax = priceMax === "" ? undefined : Number(priceMax);
    }
    // Session key is random, tab-scoped; storage failure falls back to memory.
    if (!sessionKey.current) {
      try {
        const stored = sessionStorage.getItem("giftia_session");
        sessionKey.current = stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stored) ? stored : crypto.randomUUID();
        sessionStorage.setItem("giftia_session", sessionKey.current);
      } catch { sessionKey.current = crypto.randomUUID(); }
    }
    condition.sessionKey = sessionKey.current;
    await runSearch(condition);
  }

  // ③ 画面
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
            <label>価格下限（円）<input type="number" min="0" step="1" value={priceMin} onChange={e => setPriceMin(e.target.value)} /></label>
            <label>価格上限（円）<input type="number" min="0" step="1" value={priceMax} onChange={e => setPriceMax(e.target.value)} /></label>
            <input className="q" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="キーワード（例：送別 お菓子）" />
            <label>カテゴリー
              <select value={categoryId} disabled={categoryLoading || !!categoryError}
                onChange={e => setCategoryId(e.target.value)}>
                {/* 未選択は空文字。valueはID、利用者に見せる文字はname。 */}
                <option value="">すべてのカテゴリー</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {categoryLoading && <span>カテゴリーを取得中…</span>}
            {categoryError && <p role="alert">{categoryError}
              <button type="button" onClick={() => void loadCategories()}>再取得</button>
            </p>}
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
        <button type="submit" disabled={busy || (mode === "standard" && (categoryLoading || !!categoryError))}>{busy ? "検索中…" : "検索"}</button>
      </form>

      {error && <p className="summary" role="alert">{error}</p>}

      {/* 結果：同じ ResultCard を map で並べる（使い回し） */}
      {results && (
        <section>
          <p className="summary">適用条件：{applied}</p>
          <p className="summary" aria-live="polite">該当 {total} 件 ／ 上位 {results.length} 件</p>
          {total === 0 && <p>条件に合う商品が見つかりませんでした。</p>}
          {total === 0 && <div>
            {relaxations.map(r => <p key={r.key}>{r.label}を外すと {r.total} 件見つかります。</p>)}
            {relaxations.length === 0 && <p>1つの条件を外すだけでは候補が増えません。入力欄で条件を見直して、検索してください。</p>}
            <p>条件は自動変更していません。</p>
          </div>}
          {!logSaved && <p role="status">検索結果は取得しましたが、利用記録を保存できませんでした。</p>}
          <div className="grid">
            {results.map((g, i) => <ResultCard key={g.id} gift={g} rank={i + 1} />)}
          </div>
        </section>
      )}
    </main>
  );
}