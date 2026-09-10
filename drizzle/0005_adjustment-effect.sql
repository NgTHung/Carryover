-- An older installation can contain adjustments whose polarity was never stored.
-- Refuse to guess before changing the table, including soft-deleted history.
CREATE TEMP TABLE carryover_adjustment_migration_check (
  invalid INTEGER,
  CONSTRAINT legacy_adjustments_need_effect CHECK(invalid = 0)
);
--> statement-breakpoint
INSERT INTO carryover_adjustment_migration_check (invalid)
SELECT 1
WHERE EXISTS (
  SELECT 1
  FROM transactions
  WHERE direction = 'adjustment'
);
--> statement-breakpoint
DROP TABLE carryover_adjustment_migration_check;
--> statement-breakpoint
ALTER TABLE transactions
ADD COLUMN adjustment_effect TEXT
CHECK (
  (direction = 'adjustment' AND adjustment_effect IS NOT NULL AND adjustment_effect IN ('increase', 'decrease'))
  OR
  (direction <> 'adjustment' AND adjustment_effect IS NULL)
);
