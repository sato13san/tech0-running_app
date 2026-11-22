# main.py — Giftia 検索API（2週目・穴埋め版）
# 【穴1】〜【穴4】を、対応表と公式ドキュメント・データ定義.md を頼りに自分で埋める。
# 埋めるまでは ___ が残っていて動かない（/api/search を呼ぶと 500 になり、ターミナルに NameError と行番号が出る）。
# 答えは 配布コード/答え合わせ/backend/main.py（自分で埋めてから見る）。
#
# 画面（Next.js）から呼ばれる「窓口」。条件を受け取り、班のDBを検索して、結果を JSON で返す。
# 起動：uvicorn main:app --reload
# 確認：http://localhost:8000/docs（Swagger UI。ブラウザから API を試せる）

import os

from dotenv import load_dotenv
from fastapi import FastAPI, Query, HTTPException  # 【追加】HTTPExceptionを追加
from fastapi.middleware.cors import CORSMiddleware

# FR-10（検索ログの匿名保存）で追加
from database import fetch_all, execute_write, get_connection
import json
import logging
from uuid import UUID, uuid4
from pymysql import MySQLError

load_dotenv()  # .env を読む（DB の接続情報・CORS の許可）

app = FastAPI(title="Giftia Search API（Phase1）")

# ── CORS ───────────────────────────────────────
# 画面（http://localhost:3000）と API（http://localhost:8000）は別のアプリ＝オリジンが違う。
# ブラウザは既定で「別オリジンへの通信」を止めるので、API 側が「この画面からは受け付ける」と宣言する。
# 許可する画面の URL は .env の CORS_ORIGINS に書く（カンマ区切りで複数可）。空なら何も許可しない。
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET"], allow_headers=["*"])


@app.get("/api/health")
def health():
    """つながっているかの確認。どの DB に何件の商品があるか"""
    row = fetch_all("SELECT DATABASE() AS db, COUNT(*) AS products FROM products")[0]
    return {"status": "ok", "db": row["db"], "products": row["products"]}


@app.get("/api/categories")
def categories():
    # 【PR-16・追加】IDは識別用、sort_orderは並び替え用。名称と順番をDBから返す。
    # この単独APIではfetch_allが接続を開いて閉じる。
    return {"categories": fetch_all(
        "SELECT category_id AS id, category_name AS name, sort_order AS sortOrder "
        "FROM product_category ORDER BY sort_order, category_id"
    )}


@app.get("/api/life-scenes")
def life_scenes():
    return {"lifeScenes": fetch_life_scenes()}


# 【PR-13・追加】公開APIの引数・返却形式は変えず、DB取得を共通関数へ分ける。
# 検索からはconnを渡し、単独APIからは省略する。
def fetch_life_scenes(conn=None):
    """有効なライフシーンの一覧をlifeScenesに入れて返す。"""
    return fetch_all(
        # ASでDBの列名をAPIのレスポンスで使う名前に揃える。
        "SELECT life_scene_id AS id, scene_name AS name, card_label AS cardLabel,"
        # is_activeが1のシーンだけを取得する。
        "sort_order AS sortOrder FROM life_scenes WHERE is_active = 1"
        # sort_order の値が小さいシーンから並べる。同じ値ならシーンIDが小さい方を先にする。
        " ORDER BY sort_order, life_scene_id"
    , conn=conn)


# 【追加】build_whereとcount_matches
# 追加：サイズ不要
def build_where(q, category, indiv_wrap, price_min, price_max, scene_ids, size_free=False, category_id=None):
    """商品検索の条件をANDでつなぎ、条件式と%sに入る値を返す。
    
    値は条件式に書き込まず、%sの出現順に並べて別に返す。
    呼び出し元はSQLを実行するときに、SQL文と値をそれぞれ渡す。
    """
    where, params = ["stock > 0"], []

    # キーワードは全て一致させる。各単語は商品名・ブランド・説明文の
    # いずれかに含まれていればよく、単語ごとに一致する項目が違ってもよい。
    for word in q.split():
        where.append("(product_name LIKE %s OR brand LIKE %s OR description LIKE %s)")
        params += [f"%{word}%"] * 3
    # 【PR-16・変更】旧名称も入口でIDに変換済み。検索と緩和で同じ条件を使う。
    # category引数は既存呼出形式との互換用。値はSQLに埋め込まず%sへ渡す。
    if category_id is not None:
        where.append("products.category_id = %s")
        params.append(category_id)
    if indiv_wrap:
        # 個包装ありと確認済みの商品だけを対象にする（0・NULLは除外）。
        where.append("products.is_individually_wrapped = 1")
    if price_min is not None:
        where.append("price >= %s")
        params.append(price_min)
    if price_max is not None:
        where.append("price <= %s")
        params.append(price_max)
    if scene_ids:
        # 指定されたシーンのうち、有効なものに1件でも紐づく商品を対象にする。
        # 複数のシーンに一致しても検索結果で商品が重複しないよう、EXISTSで判定する。
        marks = ",".join(["%s"] * len(scene_ids))
        where.append(f"""EXISTS (
            SELECT 1 FROM product_life_scenes pls
            JOIN life_scenes ls ON ls.life_scene_id = pls.life_scene_id
            WHERE pls.product_id = products.product_id
              AND ls.is_active = 1 AND ls.life_scene_id IN ({marks})
        )""")
        params.extend(scene_ids)
    # 追加：サイズ選び不要のフラグ反映
    # サイズ選び不要を指定されたときは、DBで「不要」と判定済みの商品だけに絞る。
    # is_size_free が 0（サイズ選びが必要）または NULL（未判定）の商品は対象外。
    if size_free:
        where.append("is_size_free = 1")

    return " AND ".join(where), tuple(params)


def count_matches(condition, conn=None):
    """検索条件に当てはまる商品の件数を返す。"""
    # conditionの各項目をbuild_whereの引数として渡し、
    # WHERE句の条件式と、%sに出現順で渡す値を受け取る。
    where, params = build_where(**condition)

    # 条件に合う商品を COUNT(*) で数える
    # 集計結果の1行目からn列の値を取り出し、整数にして返す。
    # 【PR-13・変更】条件緩和の件数も、検索が開いた同じconnで調べる。
    return int(fetch_all(f"SELECT COUNT(*) AS n FROM products WHERE {where}", params, conn=conn)[0]["n"])


@app.get("/api/search")
def search(
    q: str = Query(default="", description="キーワード（空白区切りで複数。すべてを含む商品）"),
    category: str = Query(default="", description="カテゴリー（空ならすべて）"),
    # 【PR-16・追加】新画面はIDを送る。旧category（名称）も引き続き受け付ける。
    category_id: int | None = Query(default=None, ge=1),
    indiv_wrap: bool = Query(default=False, description="true なら、個包装ありと確認済みの商品だけ"),
    price_min: int | None = Query(default=None, ge=0, description="価格の下限（以上）"),
    price_max: int | None = Query(default=None, ge=0, description="価格の上限（以下）"),
    limit: int = Query(default=20, ge=1, le=100, description="返す件数"),
    life_scene_ids: list[str] = Query(default=[]),
    size_free: bool = Query(default=False),  # 追加：サイズ選び不要
    session_key : UUID | None = Query(default=None),  # 追加：匿名のセッションキー
):
    """条件に合う商品を、人気順（直近1年の販売数）で上位 limit 件返す"""
    # 追加：価格の上下限が両方あり、下限が上限を超えている場合は422を返す。
    if price_min is not None and price_max is not None and price_min > price_max:
        raise HTTPException(status_code=422, detail = "価格の下限は上限以下にしてください")

    # 追加：受け取った生活シーンIDは、重複を除く前の件数で6件までとする。
    if len(life_scene_ids) > 6:
        raise HTTPException(status_code=422, detail="生活シーンは6件以内です")

    # 追加：指定順を保って重複を除き、選択肢APIが返す有効なIDと照合する。
    # 利用できないIDが1つでもあれば、商品検索に進む前に422を返す。
    # 【PR-13・追加】形式検証がすんだら、この検索専用の接続を1本だけ開く。
    # シーン確認・件数・商品・表示理由・ログへ同じconnを渡す。
    # 別のリクエストとは共有しない。
    conn = get_connection()
    try:
        # 【PR-16・追加】ID指定と旧名称指定を同じID条件に正規化する。
        # 存在しないIDは422。未選択のNoneとは区別する。
        resolved_category_id = category_id
        if category_id is not None:
            found = fetch_all("SELECT category_id FROM product_category WHERE category_id=%s",
                            (category_id,), conn=conn)
            if not found:
                raise HTTPException(status_code=422, detail="利用できないカテゴリーです")
        if category:
            found = fetch_all("SELECT category_id FROM product_category WHERE category_name=%s",
                            (category,), conn=conn)
            # 旧APIの未知の名称は、従来と同じ0件になる内部値にする。
            legacy_id = int(found[0]["category_id"]) if found else -1
            # IDと名称が両方届いた場合、異なる分類を指していれば入力エラー。
            if category_id is not None and category_id != legacy_id:
                raise HTTPException(status_code=422, detail="カテゴリーIDと名称が一致しません")
            resolved_category_id = legacy_id
        scene_ids = list(dict.fromkeys(life_scene_ids))
        if scene_ids:
            active = {r["id"] for r in fetch_life_scenes(conn)}
            if set(scene_ids) - active:
                raise HTTPException(
                    status_code=422,
                    detail="利用できない生活シーンです。再取得してください",
                )

        # 変更：search()内にあったWHERE句の組み立てをbuild_where()に移した。
        # 在庫・キーワード・カテゴリー・個包装・価格に、生活シーンとサイズの条件を加える。
        # 複数の生活シーンはどれか1つに一致すればよく、他の条件も同時に満たす必要がある。
        condition = dict(
            q=q,
            category=category,
            category_id=resolved_category_id,
            indiv_wrap=indiv_wrap,
            price_min=price_min,
            price_max=price_max,
            scene_ids=scene_ids,
        )
        condition["size_free"] = size_free  # 追加：サイズ不要
        where, params = build_where(**condition)

        # 【PR-14・変更】通常検索のCOUNTを別に実行せず、一覧SELECTへまとめる。
        # COUNT(*) OVER()はWHERE適用後・LIMIT適用前の件数を各行に付ける。
        # 条件緩和は検索条件が異なるため、下のcount_matchesは残す。

        # 変更：商品一覧の取得項目にdescriptionを追加した。
        rows = fetch_all(
            # 追加：サイズ選び不要
            # todo: 候補の並び順を変えなくても良いか要検討
            f"""SELECT product_id,
                -- 【PR-16・変更】カードには従来と同じ名称文字列を返す。
                (SELECT pc.category_name FROM product_category pc
                WHERE pc.category_id=products.category_id) AS category, brand, product_name, price, rating, review_count, description, is_size_free,
                COUNT(*) OVER() AS total_count
                FROM products WHERE {where}
                ORDER BY sales_count DESC, product_id
                LIMIT %s""",
            (*params, limit), conn=conn,
        )

        # 【PR-14・追加】0件なら先頭行はないので0を使い、添字エラーを防ぐ。
        # 上位20件でもtotalは全一致件数。この例はOFFSETなしの検索用。
        total = int(rows[0]["total_count"]) if rows else 0

        # 追加：一覧に載る商品について、選択された有効な生活シーンとの一致をまとめて取得する。
        # 1商品ずつSQLを実行すると表示件数に応じて問合せが増えるため、1回にまとめる。
        labels = {}
        if rows and scene_ids:
            # SQLが出てくる順に、先に商品ID、次に生活シーンIDを%sに渡す。
            marks = ",".join(["%s"] * len(rows))
            scene_marks = ",".join(["%s"] * len(scene_ids))
            links = fetch_all(f"""
                SELECT pls.product_id, ls.life_scene_id AS id, ls.scene_name AS name,
                    ls.card_label AS cardLabel, ls.sort_order AS sortOrder
                FROM product_life_scenes pls
                JOIN life_scenes ls ON ls.life_scene_id = pls.life_scene_id
                WHERE pls.product_id IN ({marks}) AND ls.is_active = 1 AND ls.life_scene_id IN ({scene_marks})
                ORDER BY ls.sort_order, ls.life_scene_id
            """, (*[r["product_id"] for r in rows], *scene_ids), conn=conn)

            # 商品IDを振り分けに使い、各商品に付ける一致理由の一覧を作る。
            for link in links:
                product_id = link.pop("product_id")
                labels.setdefault(product_id, []).append(link)

        # 変更：to_gift()が返す基本情報に、説明文・一致理由を追加する。
        results = []
        for row in rows:
            gift = to_gift(row)
            gift["description"] = row["description"] or ""
            gift["lifeScenes"] = labels.get(row["product_id"], [])
            # DBの1/0はtrue/falseに変換し、未判定のNullはNullとして返す。
            gift["isSizeFree"] = None if row["is_size_free"] is None else bool(row["is_size_free"])
            results.append(gift)
        # 追加：検索結果をまとめる。条件を緩める提案は、必要なときだけ後で追加する。
        response = {"total": total, "results": results, "relaxations": []}

        # 0件だったときだけ、指定され他条件を1種類ずつ外す候補を作る。
        # todo: 閾値を0件にするか、緩和条件の優先度変更を検討
        if total == 0:
            candidates = []
            if price_min is not None or price_max is not None:
                # 価格条件を外すときは、下限と上限の両方を解除する。
                candidates.append(("price", "価格条件", dict(price_min=None, price_max=None)))
            if scene_ids:
                candidates.append(("lifeScenes", "生活シーン", dict(scene_ids=[])))
            if size_free:
                candidates.append(("sizeFree", "サイズ選び不要", dict(size_free=False)))
            # 【PR-16・変更】カテゴリ緩和では旧名称とIDの両方を外す。
            # IDだけが残ると、条件を外したことにならない。
            if category or category_id is not None:
                candidates.append(("category", "カテゴリー", dict(category="", category_id=None)))
            if q.strip():
                candidates.append(("keyword", "キーワード", dict(q="")))
            if indiv_wrap:
                candidates.append(("indivWrap", "個包装", dict(indiv_wrap=False)))

            for key, label, change in candidates:
                # 元の検索条件を保ち、今回外す条件だけを上書きして件数を数える。
                # 検索APIを呼びなおさないので、候補を調べても検索ログは増えない。
                n = count_matches({**condition, **change}, conn=conn)
                if n > 0:
                    # 商品が1件以上見つかる候補だけを画面に返す。
                    response["relaxations"].append({"key": key, "label": label, "total": n})

        # ユーザーが実際に行った検索を1回分だけ記録する。
        # 生の検索キーワード、ユーザーID、IPアドレス、ユーザーエージェントは保存しない。
        try:
            # 匿名キーが渡されていなければ、新しいUUIDを発行する。
            execute_write(
                "INSERT INTO search_logs (session_key, life_scene_ids, size_free, result_count) "
                "VALUES (%s, %s, %s, %s)",
                (str(session_key or uuid4()), json.dumps(scene_ids), int(size_free), total), conn=conn
            )
            response["logSaved"] = True  # 【PR-14・追加】PR-13の修正漏れ対応
            
        except MySQLError:
            # ログ保存に失敗しても検索結果は返す。保存の成否はlogSavedで伝える。
            logging.getLogger(__name__).warning("search_log_write_failed")
            response["logSaved"] = False
        return response
    finally:
        # 【PR-13・追加】成功・入力不正・DB例外のいずれでも最後に閉じる。
        conn.close()


def to_gift(r: dict) -> dict:
    """DB の列名 → 画面（lib/api.ts の Gift 型）の項目名。画面側は1週目のまま変えない"""
    return {
        "id": r["product_id"],
        "category": r["category"],
        "brand": r["brand"],
        "name": r["product_name"],  # 【穴4】商品名の列名（データ定義.md の products を見る）
        "price": r["price"],
        "rating": float(r["rating"]) if r["rating"] is not None else 0,  # レビューなしは 0
        "reviewCount": r["review_count"],
    }
