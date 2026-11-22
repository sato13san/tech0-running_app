-- 読み取りだけ。接続先と結果を記録してから次の手順へ。
USE giftia_t203;
SELECT DATABASE(), VERSION();
SHOW CREATE TABLE products;
SHOW CREATE TABLE product_life_scenes;
SHOW INDEX FROM products;
SHOW INDEX FROM product_life_scenes;
SHOW INDEX FROM life_scenes;
SELECT COUNT(*) AS product_count FROM products;
SELECT COUNT(*) AS order_count FROM orders;
SELECT category, COUNT(*) AS all_products, SUM(stock > 0) AS in_stock
FROM products GROUP BY category ORDER BY category;
-- 上記は移行直前の基準としてCSV保存。8,000は既知の基準値であり実測を優先。
