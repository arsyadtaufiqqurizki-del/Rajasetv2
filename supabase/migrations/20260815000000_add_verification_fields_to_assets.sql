-- Physical verification tracking per asset: Verification (yes/no), Verification Date,
-- and Item Status (audit result, independent from the operational `status` column).
ALTER TABLE assets ADD COLUMN IF NOT EXISTS verification BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS verification_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS item_status TEXT NOT NULL DEFAULT '';

-- Lookup table for Item Status suggestions, same pattern as subsidiaries / category_segments_*.
CREATE TABLE IF NOT EXISTS item_statuses (
  name TEXT PRIMARY KEY
);

ALTER TABLE item_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read item statuses"
  ON item_statuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert item statuses"
  ON item_statuses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update item statuses"
  ON item_statuses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete item statuses"
  ON item_statuses FOR DELETE
  TO authenticated
  USING (true);

INSERT INTO item_statuses (name) VALUES ('Asset'), ('Inventory'), ('Needs Review')
  ON CONFLICT (name) DO NOTHING;
