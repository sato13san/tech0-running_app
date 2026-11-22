USE giftia_t203;
-- 11のCOMMIT後、書込停止を維持/二重書込を確認したまま再検証。
SELECT COUNT(*) AS unassigned FROM products WHERE category_id IS NULL;
SELECT COUNT(*) AS orphan_ids FROM products p LEFT JOIN product_category c
ON p.category_id=c.category_id WHERE c.category_id IS NULL;
-- どちらも0、全商品件数・カテゴリ別件数も一致した場合だけ以下へ。
-- 既存の索引・FK名と衝突しないことを確認する。
ALTER TABLE products MODIFY COLUMN category_id INT UNSIGNED NOT NULL;
ALTER TABLE products ADD CONSTRAINT fk_products_category
 FOREIGN KEY (category_id) REFERENCES product_category(category_id);
SHOW CREATE TABLE products;
SHOW INDEX FROM products;
-- この後に新API→新画面を切替。登録・CSV取込もcategory_idを必ず設定する。
-- 旧categoryは残す。名称変更は移行期間中に行わず両列を整合させる。
