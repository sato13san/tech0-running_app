// app/ResultCard.tsx — 結果カード（部品）。2週目の変更は import の1行だけ（Gift 型の置き場所が lib/api.ts に変わった）
import type { Gift } from "@/lib/api";

export default function ResultCard({ gift, rank }: { gift: Gift; rank: number }) {
  return (
    <div className="card">
      <p className="meta">{rank}位・{gift.category}・{gift.brand}</p>
      <h3 className="name">{gift.name}</h3>
      <p>{gift.description}</p>
      <div className="badges">{gift.lifeScenes.map(s => <span key={s.id} className="badge">{s.cardLabel}</span>)}</div>
      {gift.isSizeFree === true && <span className="badge">サイズ選び不要</span>}
      <p className="price">{gift.price.toLocaleString()}円</p>
      <p className="meta">
        {gift.rating === null
          ? "評価なし"
          : `評価 ${gift.rating}（${gift.reviewCount}件）`}
      </p>
    </div>
  );
}