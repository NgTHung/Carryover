PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_month_config` (
	`id` text PRIMARY KEY DEFAULT (
  lower(
    hex(randomblob(4)) || '-' ||
    hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', (random() & 3) + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' ||
    hex(randomblob(6))
  )
) NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	`period` text NOT NULL,
	`opening_balance` integer NOT NULL,
	`income_total` integer NOT NULL,
	`reserved_total` integer NOT NULL,
	`horizon_date` text NOT NULL,
	CONSTRAINT "month_config_opening_balance_signed_vnd" CHECK(typeof("__new_month_config"."opening_balance") = 'integer' AND "__new_month_config"."opening_balance" >= -9007199254740991 AND "__new_month_config"."opening_balance" <= 9007199254740991),
	CONSTRAINT "month_config_income_total_non_negative_vnd" CHECK(typeof("__new_month_config"."income_total") = 'integer' AND "__new_month_config"."income_total" >= 0 AND "__new_month_config"."income_total" <= 9007199254740991),
	CONSTRAINT "month_config_reserved_total_non_negative_vnd" CHECK(typeof("__new_month_config"."reserved_total") = 'integer' AND "__new_month_config"."reserved_total" >= 0 AND "__new_month_config"."reserved_total" <= 9007199254740991)
);
--> statement-breakpoint
INSERT INTO `__new_month_config`("id", "created_at", "updated_at", "deleted_at", "period", "opening_balance", "income_total", "reserved_total", "horizon_date") SELECT "id", "created_at", "updated_at", "deleted_at", "period", "opening_balance", "income_total", "reserved_total", "horizon_date" FROM `month_config`;--> statement-breakpoint
DROP TABLE `month_config`;--> statement-breakpoint
ALTER TABLE `__new_month_config` RENAME TO `month_config`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `month_config_period_unique` ON `month_config` (`period`);