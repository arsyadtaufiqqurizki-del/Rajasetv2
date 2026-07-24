-- Sama model trust dengan asset_reclassifications: semua authenticated user bisa hapus report
CREATE POLICY "authenticated users can delete report history"
  ON report_history FOR DELETE
  TO authenticated
  USING (true);
