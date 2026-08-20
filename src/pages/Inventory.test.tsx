import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Inventory from './Inventory';

// The CSV row-validation rules (Inventory.tsx handleImportCSV, ~line 178-197) are
// inline inside a Papa.parse callback with no standalone export. We drive the real
// import pipeline through a simulated file upload and read the outcome off the
// rendered ImportProgressModal, pinning current behaviour ahead of any extraction.

const mockAddAsset = vi.fn(() => Promise.resolve());

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => ({
    assets: [],
    deleteAsset: vi.fn(),
    deleteMultipleAssets: vi.fn(),
    deleteAllAssets: vi.fn(),
    setEditingAsset: vi.fn(),
    setIsEditModalOpen: vi.fn(),
    setIsAddModalOpen: vi.fn(),
    subsidiaries: [],
    categories1: [],
    categories2: [],
    itemStatuses: [],
    addAsset: mockAddAsset,
  }),
}));
vi.mock('../lib/activityLogger', () => ({
  logActivity: vi.fn(),
}));

function renderInventory() {
  return render(
    <MemoryRouter>
      <Inventory />
    </MemoryRouter>
  );
}

describe('Inventory CSV import row validation', () => {
  it('accepts rows with both fields, and reports a specific reason per invalid row', async () => {
    const csv = [
      'Asset Number,Asset Description',
      'AN-100,Valid Asset',
      ',Missing Number Desc',
      'AN-102,',
      ',',
    ].join('\n');
    const file = new File([csv], 'assets.csv', { type: 'text/csv' });

    renderInventory();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Import Complete')).toBeInTheDocument();
    });

    // Only the fully-populated row reaches addAsset.
    expect(mockAddAsset).toHaveBeenCalledTimes(1);
    expect(mockAddAsset).toHaveBeenCalledWith(
      expect.objectContaining({ assetNumber: 'AN-100', assetDescription: 'Valid Asset' }),
      true,
    );

    expect(screen.getByText('1 assets')).toBeInTheDocument(); // Successfully imported
    expect(screen.getByText('3 rows')).toBeInTheDocument(); // Skipped (invalid rows)

    expect(screen.getByText('Asset Number kosong')).toBeInTheDocument();
    expect(screen.getByText('Asset Description kosong')).toBeInTheDocument();
    expect(screen.getByText('Asset Number kosong, Asset Description kosong')).toBeInTheDocument();
  });
});
