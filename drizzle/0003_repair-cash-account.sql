-- Repair databases where Expo prepared only the first statement in 0002.
INSERT INTO accounts (name, kind, is_default, opening_balance)
SELECT 'Cash', 'cash', 0, 0
WHERE NOT EXISTS (
  SELECT 1 FROM accounts WHERE deleted_at IS NULL AND kind = 'cash'
);
