-- Seed the two fixed accounts once the ledger schema exists.
INSERT INTO accounts (name, kind, is_default, opening_balance)
SELECT 'Bank', 'bank', 1, 0
WHERE NOT EXISTS (
  SELECT 1 FROM accounts WHERE deleted_at IS NULL
);
--> statement-breakpoint

INSERT INTO accounts (name, kind, is_default, opening_balance)
SELECT 'Cash', 'cash', 0, 0
WHERE NOT EXISTS (
  SELECT 1 FROM accounts WHERE deleted_at IS NULL AND kind = 'cash'
);
