USE giftia_t203;
-- 書込停止中、または全書込元が旧名とIDの両方を設定する状態で実行。
-- 型・文字セット・照合順序はSHOW CREATE TABLEで確認済みの前提。
START TRANSACTION;
UPDATE products p JOIN product_category c ON p.category=c.category_name
SET p.category_id=c.category_id WHERE p.category_id IS NULL;
SELECT COUNT(*) AS unassigned FROM products WHERE category_id IS NULL;
SELECT COUNT(*) AS inconsistent FROM products p LEFT JOIN product_category c
ON c.category_id=p.category_id
WHERE c.category_id IS NULL OR NOT (p.category <=> c.category_name);
SELECT COUNT(*) AS product_count FROM products;
SELECT p.category AS old_name,c.category_name AS new_name,COUNT(*) AS n
FROM products p LEFT JOIN product_category c ON p.category_id=c.category_id
GROUP BY p.category,c.category_name ORDER BY p.category;
-- unassigned=0、inconsistent=0、総数・各カテゴリ件数が移行前と一致なら
-- 同じ接続で COMMIT; を選ぶ。不一致なら ROLLBACK; を選び原因を調べる。
-- 確認なしでまとめてCOMMITしない。
