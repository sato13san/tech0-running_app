-- PR-05用。04_size_and_logs.sqlとの重複実行をしない。
USE giftia_t203;
SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND COLUMN_NAME='is_size_free';
-- 0行だった場合だけ次を実行。既存列があれば型を確認して再追加しない。
ALTER TABLE products ADD COLUMN is_size_free TINYINT NULL DEFAULT NULL;

-- AI壁打ち指摘対応：サイズ追加確認用の仮判定値セット（1:不要 / 0:必要 / NULL:未判定）
UPDATE products
SET is_size_free = 1
WHERE product_id IN ('G0001' COLLATE utf8mb4_ja_0900_as_cs, 'G0061' COLLATE utf8mb4_ja_0900_as_cs);

UPDATE products
SET is_size_free = 0
WHERE product_id = 'G0004' COLLATE utf8mb4_ja_0900_as_cs;