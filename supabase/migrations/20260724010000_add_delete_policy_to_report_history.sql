-- Sama model trust dengan asset_reclassifications: semua authenticated user bisa hapus report
DROP POLICY IF EXISTS "authenticated users can delete report history" ON report_history;
CREATE POLICY "authenticated users can delete report history"
  ON report_history FOR DELETE
  TO authenticated
  USING (true);
