USE giftia_t203;
-- 対象は09で固定したExcelの1000商品。誕生日タグは必須にしない。
SET @product='G0061' COLLATE utf8mb4_ja_0900_as_cs;
SET @reviewed=0; -- 説明・商品ID・候補集合・LS01/LS03の根拠を人が確認後だけ1にする。
SELECT p.product_id,p.product_name,p.description,p.size,p.stock,p.sales_count
FROM products p WHERE p.product_id=@product;
-- SELECT * FROM phase1_target_products WHERE product_id=@product; -- 段階3で作成後に有効化
SELECT * FROM product_life_scenes WHERE product_id=@product;
-- 既に同じキーがあれば、以下の初回INSERTは繰り返さず既存値を確認する。
START TRANSACTION;
INSERT INTO product_life_scenes
(product_id,life_scene_id,tag_method,tagged_by,tagged_at)
SELECT p.product_id,l.life_scene_id,'manual','けんてぃ',CURRENT_TIMESTAMP
FROM products p CROSS JOIN life_scenes l
WHERE @reviewed=1 AND p.product_id=@product
 AND p.product_name='Pocolo 温度調節電気ケトル 0.8L'
 AND l.life_scene_id IN ('LS01','LS03') AND l.is_active=1;
 -- AND EXISTS (SELECT 1 FROM phase1_target_products t
 --             WHERE BINARY t.product_id=BINARY p.product_id);
SELECT ROW_COUNT() AS inserted_links; -- @reviewed=0なら0。承認して初回投入する場合は2。
SELECT * FROM product_life_scenes WHERE product_id=@product;
ROLLBACK; -- 初回は練習。本投入はSTART TRANSACTIONから再実行し確認後COMMIT。
-- 実DBの商品名・説明が抽出時から変わった場合、判定をやり直す。

-- AI壁打ち指摘対応：テスト検証用の少量タグ補完（G0001:LS01 / G0002:LS03）
INSERT IGNORE INTO product_life_scenes
  (product_id, life_scene_id, tag_method, tagged_by, tagged_at)
SELECT p.product_id, l.life_scene_id, 'manual', 'けんてぃ', CURRENT_TIMESTAMP
FROM products p CROSS JOIN life_scenes l
WHERE (p.product_id = 'G0001' COLLATE utf8mb4_ja_0900_as_cs AND l.life_scene_id = 'LS01')
   OR (p.product_id = 'G0002' COLLATE utf8mb4_ja_0900_as_cs AND l.life_scene_id = 'LS03');