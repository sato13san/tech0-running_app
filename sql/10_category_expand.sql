-- 書き込み手順の回答例。対象環境・バックアップ・書き込み停止/二重書込の合意後に実行。
-- 同名表/列がないことをSHOW TABLES / SHOW COLUMNSで確認。DDLはROLLBACK不可。
USE giftia_t203;
-- sql/10_category_expand.sql の定義も以下のように揃えておくと再現性が保てます
CREATE TABLE product_category (
 category_id INT UNSIGNED NOT NULL PRIMARY KEY,
 category_name VARCHAR(50) NOT NULL UNIQUE,
 sort_order INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_ja_0900_as_cs;
INSERT INTO product_category (category_id,category_name,sort_order) VALUES
 (1,'食品',10),(2,'飲料',20),(3,'酒類',30),(4,'生活雑貨',40),
 (5,'インテリア',50),(6,'家電',60),(7,'コスメ',70),(8,'ビジネス小物',80),
 (9,'フラワー',90),(10,'カタログギフト',100);
ALTER TABLE products ADD COLUMN category_id INT UNSIGNED NULL;
-- ここで止める。旧categoryを残し、次のファイルで未割当・件数を検証する。
