USE giftia_t203;
-- 退避した旧categoryと現在の列を照合し、旧名が最新であることを確認してから。
-- 新画面を停止/旧画面へ戻す。旧書込元を再開する前にNULLを許可する。
ALTER TABLE products MODIFY COLUMN category_id INT UNSIGNED NULL;
-- 旧API（step2時点）・旧画面へ担当者が戻す。
-- マスタ、ID列、FK、旧categoryは残す。DROPや全表復元は自動で行わない。
-- 新規商品や移行後の更新をバックアップで上書きしない。
