SELECT @@session.time_zone, @@global.time_zone;
SELECT COUNT(*) AS searches,
 SUM(result_count=0) AS zero_results,
 ROUND(100.0 * SUM(result_count=0)/NULLIF(COUNT(*),0),1) AS zero_percent
FROM search_logs;
SELECT COUNT(DISTINCT session_key) AS searched_sessions,
 COUNT(DISTINCT CASE WHEN life_scene_ids <> '[]' OR size_free=1 THEN session_key END) AS used_sessions
FROM search_logs;
SELECT log_id,life_scene_ids,size_free,result_count,searched_at
FROM search_logs ORDER BY log_id DESC LIMIT 20;
