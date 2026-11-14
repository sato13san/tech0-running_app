USE giftia_t203;
-- 新規表がまだ無いことをSHOW TABLESで確認してから実行。
CREATE TABLE life_scenes (
  life_scene_id VARCHAR(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  scene_name VARCHAR(50) NOT NULL,
  definition TEXT NOT NULL,
  card_label VARCHAR(15) NOT NULL,
  sort_order INT NOT NULL,
  is_active TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (life_scene_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 実DBのproduct_id定義からCREATE文を生成する（まだ実行しない）。
SELECT CONCAT(
 'CREATE TABLE product_life_scenes (product_id ', COLUMN_TYPE,
 ' CHARACTER SET ', CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME,
 ' NOT NULL, life_scene_id VARCHAR(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,',
 ' tag_method VARCHAR(10) NOT NULL, tagged_by VARCHAR(50) NOT NULL,',
 ' tagged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,',
 ' PRIMARY KEY (product_id, life_scene_id),',
 ' KEY ix_life_product (life_scene_id, product_id),',
 ' FOREIGN KEY (product_id) REFERENCES products(product_id),',
 ' FOREIGN KEY (life_scene_id) REFERENCES life_scenes(life_scene_id)',
 ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;') AS ddl_to_review
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND COLUMN_NAME='product_id';
-- 出力されたCREATE TABLEをコピーし、型・FKを確認して別のSQLタブで実行する。
CREATE TABLE product_life_scenes (product_id varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_ja_0900_as_cs NOT NULL, life_scene_id VARCHAR(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, tag_method VARCHAR(10) NOT NULL, tagged_by VARCHAR(50) NOT NULL, tagged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (product_id, life_scene_id), KEY ix_life_product (life_scene_id, product_id), FOREIGN KEY (product_id) REFERENCES products(product_id), FOREIGN KEY (life_scene_id) REFERENCES life_scenes(life_scene_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- 実行後：
SHOW CREATE TABLE product_life_scenes;
