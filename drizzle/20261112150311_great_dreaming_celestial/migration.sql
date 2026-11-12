CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"from_wallet_id" uuid NOT NULL,
	"to_wallet_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfers_amount_minor_more_than_zero" CHECK ("amount_minor" > 0),
	CONSTRAINT "transfers_distinct_wallets" CHECK ("from_wallet_id" <> "to_wallet_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"transfer_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_wallet_id_wallets_id_fkey" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_wallet_id_wallets_id_fkey" FOREIGN KEY ("to_wallet_id") REFERENCES "wallets"("id");--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transfer_id_transfers_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id");--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_id_wallets_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id");