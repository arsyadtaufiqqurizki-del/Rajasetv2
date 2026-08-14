-- "Add Item" now always creates a row linked to an existing asset (asset_id set),
-- whose identifying fields (including description) resolve live via the assets join
-- in ReclassificationContext.fromDb() — the raw asset_description column is no longer
-- populated at insert time for linked rows, so it can no longer be required.
ALTER TABLE asset_reclassifications ALTER COLUMN asset_description DROP NOT NULL;
