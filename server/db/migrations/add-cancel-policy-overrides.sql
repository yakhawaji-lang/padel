-- cancel_policy_overrides on club_settings (JSON) — آمن للتنفيذ أكثر من مرة
-- Works on MySQL 5.7+ / MariaDB (uses INFORMATION_SCHEMA + prepared statement)

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'club_settings'
    AND COLUMN_NAME = 'cancel_policy_overrides'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE club_settings ADD COLUMN cancel_policy_overrides JSON NULL COMMENT ''Optional training/tournament cancel fee overrides as JSON''',
  'SELECT ''OK: cancel_policy_overrides already exists — no change.'' AS migration_result'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
