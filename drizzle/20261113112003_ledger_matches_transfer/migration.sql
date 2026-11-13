-- A transfer and its ledger entries must agree with each other. This spans several rows of two
-- tables, which CHECK and UNIQUE cannot express, so it is a constraint trigger. It is deferred:
-- the rows are written one by one inside a transaction and are complete only at COMMIT.
--
-- At commit every transfer touched by the transaction must have exactly two entries:
--   a debit  of -amount_minor on from_wallet_id
--   a credit of +amount_minor on to_wallet_id
CREATE FUNCTION "check_transfer_ledger"() RETURNS trigger AS $$
DECLARE
  touched uuid[] := '{}';
  checked_id uuid;
  transfer "transfers"%ROWTYPE;
  debits integer;
  credits integer;
  total integer;
BEGIN
  -- A row variable has only the columns of its own table, and a field may be read only in the
  -- branch that runs for that table. OLD is set except on INSERT, NEW except on DELETE; an entry
  -- moved to another transfer touches both the old and the new one
  IF TG_TABLE_NAME = 'transfers' THEN
    IF TG_OP <> 'INSERT' THEN touched := touched || OLD."id"; END IF;
    IF TG_OP <> 'DELETE' THEN touched := touched || NEW."id"; END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN touched := touched || OLD."transfer_id"; END IF;
    IF TG_OP <> 'DELETE' THEN touched := touched || NEW."transfer_id"; END IF;
  END IF;

  FOREACH checked_id IN ARRAY touched
  LOOP
    SELECT * INTO transfer FROM "transfers" WHERE "id" = checked_id;

    -- The transfer itself is gone; its entries cannot outlive it because of the foreign key
    CONTINUE WHEN NOT FOUND;

    SELECT
      count(*) FILTER (WHERE "direction" = 'debit' AND "wallet_id" = transfer."from_wallet_id" AND "amount" = -transfer."amount_minor"),
      count(*) FILTER (WHERE "direction" = 'credit' AND "wallet_id" = transfer."to_wallet_id" AND "amount" = transfer."amount_minor"),
      count(*)
    INTO debits, credits, total
    FROM "ledger_entries"
    WHERE "transfer_id" = checked_id;

    IF debits <> 1 OR credits <> 1 OR total <> 2 THEN
      RAISE EXCEPTION 'transfer % must have exactly one debit of its amount on the sender wallet and one credit of its amount on the receiver wallet', checked_id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'ledger_entries_match_transfer';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "ledger_entries_match_transfer"
  AFTER INSERT OR UPDATE OR DELETE ON "ledger_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "check_transfer_ledger"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "transfers_match_ledger_entries"
  AFTER INSERT OR UPDATE ON "transfers"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "check_transfer_ledger"();
