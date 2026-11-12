CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" uuid NOT NULL UNIQUE,
	"request_hash" text NOT NULL,
	"transfer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_transfer_id_transfers_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id");