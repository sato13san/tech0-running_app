-- 事前: 05の全検査が0行、予定件数一致、既存データの退避済み。
-- 退避表の作成はtransactionの前。既存同名表は上書きしない。
CREATE TABLE backup_tags_1122 LIKE product_life_scenes;
INSERT INTO backup_tags_1122 SELECT pls.* FROM product_life_scenes pls
WHERE EXISTS (SELECT 1 FROM stage_review_1122 s WHERE BINARY s.product_id=BINARY pls.product_id);
CREATE TABLE backup_size_1122 AS
SELECT p.product_id,p.is_size_free FROM products p
WHERE EXISTS (SELECT 1 FROM stage_review_1122 s WHERE BINARY s.product_id=BINARY p.product_id);

START TRANSACTION;
-- レビューした1000商品のシーンを完全置換。not_applicableも既存タグを除去する。
-- 既存タグを残す場合は判定し、tags_ready.csvに全て列挙する。
DELETE pls FROM product_life_scenes pls
JOIN (SELECT product_id FROM stage_review_1122) s ON s.product_id=pls.product_id;
INSERT INTO product_life_scenes (product_id,life_scene_id,tag_method,tagged_by,tagged_at)
SELECT s.product_id,s.life_scene_id,'manual',r.reviewed_by,CURRENT_TIMESTAMP
FROM stage_tags_1122 s JOIN stage_review_1122 r ON BINARY r.product_id=BINARY s.product_id;
UPDATE products p JOIN
(SELECT product_id,is_size_free AS flag FROM stage_review_1122) s
ON s.product_id=p.product_id SET p.is_size_free=CAST(s.flag AS UNSIGNED);
SELECT COUNT(*) AS applied_links FROM product_life_scenes pls
WHERE EXISTS (SELECT 1 FROM stage_review_1122 s WHERE BINARY s.product_id=BINARY pls.product_id);
SELECT p.product_id,p.is_size_free FROM products p
WHERE EXISTS (SELECT 1 FROM stage_review_1122 s WHERE BINARY s.product_id=BINARY p.product_id);
-- 初回はこのROLLBACKでリハーサル。
ROLLBACK;
-- 本投入: START TRANSACTIONからSELECTまで再実行し、問題なければCOMMITのみ実行する。
-- 各文でエラーが出たら止めてROLLBACK。DDLを途中に挟まない。
