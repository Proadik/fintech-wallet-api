CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(255) NOT NULL UNIQUE,
	"first_name" varchar(50) NOT NULL,
	"last_name" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"balance_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_currency_unique" UNIQUE("user_id","currency"),
	CONSTRAINT "wallets_balance_minor_non_negative" CHECK ("balance_minor" >= 0),
	CONSTRAINT "wallets_currency_allowed" CHECK ("currency" IN ('USD', 'EUR', 'KZT'))
);
--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");