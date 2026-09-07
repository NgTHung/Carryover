CREATE TABLE `accounts` (
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
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`opening_balance` integer NOT NULL,
	CONSTRAINT "accounts_opening_balance_non_negative_vnd" CHECK(typeof("accounts"."opening_balance") = 'integer' AND "accounts"."opening_balance" >= 0),
	CONSTRAINT "accounts_kind_value" CHECK("accounts"."kind" IN ('bank', 'cash'))
);
--> statement-breakpoint
CREATE TABLE `categories` (
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
	`parent_id` text,
	`name` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`is_suggestion` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "categories_sort_integer" CHECK(typeof("categories"."sort") = 'integer'),
	CONSTRAINT "categories_kind_value" CHECK("categories"."kind" IN ('spend', 'reserve'))
);
--> statement-breakpoint
CREATE TABLE `commitments` (
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
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`due_day` integer NOT NULL,
	`category_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "commitments_amount_positive_vnd" CHECK(typeof("commitments"."amount") = 'integer' AND "commitments"."amount" > 0),
	CONSTRAINT "commitments_due_day_range" CHECK(typeof("commitments"."due_day") = 'integer' AND "commitments"."due_day" BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
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
	`name` text NOT NULL,
	`user_id` text
);
--> statement-breakpoint
CREATE TABLE `month_config` (
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
	CONSTRAINT "month_config_opening_balance_non_negative_vnd" CHECK(typeof("month_config"."opening_balance") = 'integer' AND "month_config"."opening_balance" >= 0),
	CONSTRAINT "month_config_income_total_non_negative_vnd" CHECK(typeof("month_config"."income_total") = 'integer' AND "month_config"."income_total" >= 0),
	CONSTRAINT "month_config_reserved_total_non_negative_vnd" CHECK(typeof("month_config"."reserved_total") = 'integer' AND "month_config"."reserved_total" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `month_config_period_unique` ON `month_config` (`period`);--> statement-breakpoint
CREATE TABLE `settlements` (
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
	`contact_id` text NOT NULL,
	`amount` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	`direction` text NOT NULL,
	`note` text,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlements_amount_positive_vnd" CHECK(typeof("settlements"."amount") = 'integer' AND "settlements"."amount" > 0),
	CONSTRAINT "settlements_direction_value" CHECK("settlements"."direction" IN ('they_paid_me', 'i_paid_them'))
);
--> statement-breakpoint
CREATE TABLE `splits` (
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
	`transaction_id` text NOT NULL,
	`contact_id` text,
	`share_amount` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "splits_share_amount_positive_vnd" CHECK(typeof("splits"."share_amount") = 'integer' AND "splits"."share_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
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
	`account_id` text NOT NULL,
	`direction` text NOT NULL,
	`amount` integer,
	`category_id` text,
	`quality` text,
	`payer_contact_id` text,
	`occurred_at` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`photo_key` text,
	`note` text,
	`source_label` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payer_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "transactions_amount_integer_vnd_e0" CHECK("transactions"."amount" IS NULL OR typeof("transactions"."amount") = 'integer'),
	CONSTRAINT "transactions_amount_positive_vnd" CHECK("transactions"."amount" IS NULL OR (typeof("transactions"."amount") = 'integer' AND "transactions"."amount" > 0)),
	CONSTRAINT "transactions_complete_requires_amount" CHECK("transactions"."status" <> 'complete' OR "transactions"."amount" IS NOT NULL),
	CONSTRAINT "transactions_direction_value" CHECK("transactions"."direction" IN ('expense', 'income', 'adjustment', 'transfer')),
	CONSTRAINT "transactions_quality_value" CHECK("transactions"."quality" IS NULL OR "transactions"."quality" IN ('need', 'want', 'regret')),
	CONSTRAINT "transactions_status_value" CHECK("transactions"."status" IN ('draft', 'complete'))
);
--> statement-breakpoint
CREATE TABLE `transfers` (
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
	`from_account_id` text NOT NULL,
	`to_account_id` text NOT NULL,
	`amount` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "transfers_amount_positive_vnd" CHECK(typeof("transfers"."amount") = 'integer' AND "transfers"."amount" > 0),
	CONSTRAINT "transfers_accounts_differ" CHECK("transfers"."from_account_id" <> "transfers"."to_account_id")
);
