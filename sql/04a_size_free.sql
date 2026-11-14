-- PR-05用。04_size_and_logs.sqlとの重複実行をしない。
USE giftia_t203;
SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND COLUMN_NAME='is_size_free';
-- 0行だった場合だけ次を実行。既存列があれば型を確認して再追加しない。
ALTER TABLE products ADD COLUMN is_size_free TINYINT NULL DEFAULT NULL;
