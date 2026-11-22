# database.py — 班のDB（Azure Database for MySQL）につなぐ（穴なし。置いて、読む）
#
# 接続情報は .env に置く（Workbench に入れたものと同じ5つ）。コードに書かない。GitHub に上げない。
#   DB_HOST     = ホスト名（xxx.mysql.database.azure.com）
#   DB_PORT     = 3306
#   DB_USER     = 配られたユーザー名（例 tech0gen13-class1）
#   DB_PASSWORD = 班のパスワード
#   DB_NAME     = 班のDB名（例 giftia_t101 ＝ クラス1の班1）
#   DB_SSL_CA   = 配布された SSL証明書のパス（任意。入れると Workbench の「Verify CA」と同じく相手を確かめる）

import os

import pymysql
from dotenv import load_dotenv

load_dotenv()  # 同じフォルダの .env を読み、os.environ に入れる


def get_connection():
    """班のDBへの接続を1つ作って返す。使い終わったら close() する（fetch_all が面倒を見る）"""
    required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise EnvironmentError(f".env に設定がありません: {', '.join(missing)}（.env.example を .env にコピーして埋める）")

    # Azure は暗号化（SSL/TLS）しない接続を断る。証明書のパスがあれば、相手が Azure のサーバーかも確かめる
    ssl = {"ca": os.environ["DB_SSL_CA"]} if os.environ.get("DB_SSL_CA") else {"ssl_disabled": False}

    return pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", "3306")),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.environ["DB_NAME"],
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,  # 行を {列名: 値} の形で受け取る（JSON にしやすい）
        connect_timeout=10,
        ssl=ssl,
    )


def fetch_all(query: str, params: tuple = (), *, conn=None) -> list[dict]:
    """自分で開いた接続だけを閉じる。借りた接続は呼び出し元へ返す。"""
    # 【PR-13・変更】接続を借りたか、自分で開いたかを覚える。
    # conn省略時は従来の単独呼び出しと同じ動きにする。
    owns_connection = conn is None
    if owns_connection:
        conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()
    finally:
        # 【PR-13・変更】借りた接続は後続処理も使うため、ここでは閉じない。
        if owns_connection:
            conn.close()


def execute_write(query: str, params: tuple = (), *, conn=None) -> int:
    """成功時commit、失敗時rollback。共有接続では検索ログだけを書き込む。"""
    owns_connection = conn is None
    if owns_connection:
        conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            affected = cur.rowcount
        # 【維持】ログの保存を確定する。共有接続に他の業務更新を混ぜない
        conn.commit()
        return affected
    except Exception:
        conn.rollback()
        # 切断時にrollbackも失敗して元の例外を隠さないようにする。
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        # 【PR-13・変更】借りた接続は後続処理も使うため、ここでは閉じない。
        if owns_connection:
            conn.close()
