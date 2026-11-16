-- PR-06用。04_size_and_logs.sqlとの重複実行をしない。
USE giftia_t203;
-- search_logsが無いことを確認してから実行。
CREATE TABLE search_logs (
  log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_key CHAR(36) CHARACTER SET ascii NOT NULL,
  life_scene_ids VARCHAR(100) NOT NULL,
  size_free TINYINT NOT NULL,
  result_count INT UNSIGNED NOT NULL,
  searched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_search_time (searched_at),
  KEY ix_search_session (session_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
