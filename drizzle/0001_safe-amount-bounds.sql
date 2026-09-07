-- SQLite cannot toggle foreign-key enforcement inside Drizzle's migration transaction.
-- These triggers add the new ceiling without rebuilding tables that reference one another.
CREATE TEMP TABLE carryover_safe_vnd_migration_check (
  amount INTEGER,
  CONSTRAINT existing_ledger_amount_exceeds_safe_vnd
    CHECK(amount IS NULL OR amount <= 9007199254740991)
);
--> statement-breakpoint
INSERT INTO carryover_safe_vnd_migration_check (amount)
SELECT opening_balance FROM accounts
UNION ALL SELECT amount FROM transactions
UNION ALL SELECT share_amount FROM splits
UNION ALL SELECT amount FROM settlements
UNION ALL SELECT amount FROM commitments
UNION ALL SELECT opening_balance FROM month_config
UNION ALL SELECT income_total FROM month_config
UNION ALL SELECT reserved_total FROM month_config
UNION ALL SELECT amount FROM transfers;
--> statement-breakpoint
DROP TABLE carryover_safe_vnd_migration_check;
--> statement-breakpoint
CREATE TRIGGER accounts_opening_balance_safe_max_insert
BEFORE INSERT ON accounts
FOR EACH ROW
WHEN NEW.opening_balance > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'accounts.opening_balance exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER accounts_opening_balance_safe_max_update
BEFORE UPDATE OF opening_balance ON accounts
FOR EACH ROW
WHEN NEW.opening_balance > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'accounts.opening_balance exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER commitments_amount_safe_max_insert
BEFORE INSERT ON commitments
FOR EACH ROW
WHEN NEW.amount > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'commitments.amount exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER commitments_amount_safe_max_update
BEFORE UPDATE OF amount ON commitments
FOR EACH ROW
WHEN NEW.amount > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'commitments.amount exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER month_config_amounts_safe_max_insert
BEFORE INSERT ON month_config
FOR EACH ROW
WHEN NEW.opening_balance > 9007199254740991
  OR NEW.income_total > 9007199254740991
  OR NEW.reserved_total > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'month_config amount exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER month_config_amounts_safe_max_update
BEFORE UPDATE OF opening_balance, income_total, reserved_total ON month_config
FOR EACH ROW
WHEN NEW.opening_balance > 9007199254740991
  OR NEW.income_total > 9007199254740991
  OR NEW.reserved_total > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'month_config amount exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER settlements_amount_safe_max_insert
BEFORE INSERT ON settlements
FOR EACH ROW
WHEN NEW.amount > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'settlements.amount exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER settlements_amount_safe_max_update
BEFORE UPDATE OF amount ON settlements
FOR EACH ROW
WHEN NEW.amount > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'settlements.amount exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER splits_share_amount_safe_max_insert
BEFORE INSERT ON splits
FOR EACH ROW
WHEN NEW.share_amount > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'splits.share_amount exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER splits_share_amount_safe_max_update
BEFORE UPDATE OF share_amount ON splits
FOR EACH ROW
WHEN NEW.share_amount > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'splits.share_amount exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER transactions_amount_safe_max_insert
BEFORE INSERT ON transactions
FOR EACH ROW
WHEN NEW.amount IS NOT NULL AND NEW.amount > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'transactions.amount exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER transactions_amount_safe_max_update
BEFORE UPDATE OF amount ON transactions
FOR EACH ROW
WHEN NEW.amount IS NOT NULL AND NEW.amount > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'transactions.amount exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER transfers_amount_safe_max_insert
BEFORE INSERT ON transfers
FOR EACH ROW
WHEN NEW.amount > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'transfers.amount exceeds the safe VND amount');
END;
--> statement-breakpoint
CREATE TRIGGER transfers_amount_safe_max_update
BEFORE UPDATE OF amount ON transfers
FOR EACH ROW
WHEN NEW.amount > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'transfers.amount exceeds the safe VND amount');
END;
