// lib/api.ts — 2週目：searchGifts() の中身を「FastAPI に聞く」に差し替える（穴埋め版）
// 【穴5】【穴6】を、対応表と公式ドキュメントを頼りに自分で埋める。
// 1週目の lib/sampleGifts.ts は、このファイルに置き換える（ダミーは使わない）。
// 答えは 配布コード/答え合わせ/frontend/api.ts（自分で埋めてから見る）。

// 画面が使う商品の形。1週目と同じ（画面・ResultCard は変えない）
export type LifeScene = { id: string; name: string; cardLabel: string; sortOrder: number };
export type Relaxation = { key: string; label: string; total: number };
export type SearchResponse = { total: number; results: Gift[]; relaxations: Relaxation[]; logSaved?: boolean };
export type Category = { id: number; name: string; sortOrder: number };

export type Gift = {
  description: string;
  lifeScenes: LifeScene[];
  isSizeFree?: boolean | null;
  id: string;          // 商品ID（例 G0001）
  category: string;    // カテゴリ
  brand: string;       // ブランド・店名
  name: string;        // 商品名
  price: number;       // 価格（円）
  rating: number | null;      // レビューの平均。評価無しはnull
  reviewCount: number; // レビュー件数
};

// 画面から渡す検索条件（2つのタブの分をまとめて持つ）
export type SearchCondition = {
  categoryId?: number;
  lifeSceneIds?: string[];
  sizeFree?: boolean;
  priceMin?: number;
  priceMax?: number;
  sessionKey?: string;
  keyword: string;    // いまの検索：キーワード
  category: string;   // いまの検索：カテゴリー（空ならすべて）
  indivWrap: boolean; // 取引先へのお礼：個包装だけ
  priceBand: string;  // 取引先へのお礼："" | "3000" | "5000"
};

// API の場所。NEXT_PUBLIC_ の値はブラウザに配られる＝秘密は置かない（.env.local に書く）
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// 入力した条件をサーバー（FastAPI）に送り、結果と総件数（SearchResponse）をもらう
export async function searchGifts(c: SearchCondition): Promise<SearchResponse> {
  // ① 条件を URL のクエリ（?q=...&category=...）に組み立てる。空の条件は送らない
  const params = new URLSearchParams();
  if (c.keyword) params.set("q", c.keyword);
  if (c.categoryId !== undefined) params.set("category_id", String(c.categoryId));
  else if (c.category) params.set("category", c.category);
  if (c.indivWrap) params.set("indiv_wrap", "true");
  if (c.priceBand === "3000") { params.set("price_min", "3000"); params.set("price_max", "4999"); } // 3,000以上 5,000未満
  if (c.priceBand === "5000") { params.set("price_min", "5000"); params.set("price_max", "9999"); } // 5,000以上 10,000未満

  for (const id of c.lifeSceneIds ?? []) params.append("life_scene_ids", id);
  if (c.sizeFree) params.set("size_free", "true");
  if (c.priceMin !== undefined) params.set("price_min", String(c.priceMin));
  if (c.priceMax !== undefined) params.set("price_max", String(c.priceMax));
  if (c.sessionKey) params.set("session_key", c.sessionKey);
    // ② fetch で API を呼ぶ（通信が終わるまで待つ＝await）
  const res = await fetch(`${API}/api/search?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // ③ 返ってきた JSON 全体を返す。画面は data.results と data.total を使う
  const data = await res.json();
  return data as SearchResponse;
}

// 生活シーンの選択肢をバックエンドから取得する関数
export async function getLifeScenes(): Promise<LifeScene[]> {
  const res = await fetch(`${API}/api/life-scenes`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to fetch life scenes`);
  }
  const data = await res.json();
  return data.lifeScenes;
}

// ▼ [追加] PR-17：初期表示・再取得から呼ぶカテゴリー一覧取得関数を追加
// HTTPエラーは例外にし、画面側で再取得を案内する。
export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${API}/api/categories`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch categories`);
  const data = await res.json();
  return data.categories;
}