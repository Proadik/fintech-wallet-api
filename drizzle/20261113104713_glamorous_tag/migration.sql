-- Existing rows need a direction before the column can be NOT NULL: it is taken from the sign of the amount
ALTER TABLE "ledger_entries" ADD COLUMN "direction" varchar(6);--> statement-breakpoint
UPDATE "ledger_entries" SET "direction" = CASE WHEN "amount" < 0 THEN 'debit' ELSE 'credit' END;--> statement-breakpoint
ALTER TABLE "ledger_entries" ALTER COLUMN "direction" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transfer_id_direction_unique" UNIQUE("transfer_id","direction");--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_direction_matches_amount" CHECK (("direction" = 'debit' AND "amount" < 0) OR ("direction" = 'credit' AND "amount" > 0));
