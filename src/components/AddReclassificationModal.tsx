import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronDown, Search, Loader2 } from 'lucide-react';
import { useReclassification, RECLASSIFICATION_PRESET_CATEGORIES } from '../contexts/ReclassificationContext';
import { useAsset } from '../contexts/AssetContext';
import { id as copy } from '../i18n/id';

export default function AddReclassificationModal() {
  const { isAddModalOpen, setIsAddModalOpen, addLinkedReclassification, reclassifications } = useReclassification();
  const { assets } = useAsset();

  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [categorySelect, setCategorySelect] = useState<string>(RECLASSIFICATION_PRESET_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [remarks, setRemarks] = useState('');

  // An asset already linked to a reclassification row shouldn't be pickable again
  // here — that's what "Sync from Assets" is for in bulk; one audit row per asset.
  const alreadyLinkedIds = useMemo(
    () => new Set(reclassifications.filter(r => r.assetId).map(r => r.assetId)),
    [reclassifications]
  );
  const linkableAssets = useMemo(
    () => assets.filter(a => !alreadyLinkedIds.has(a.id)),
    [assets, alreadyLinkedIds]
  );

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return linkableAssets.slice(0, 50);
    return linkableAssets.filter(a =>
      a.assetNumber?.toLowerCase().includes(q) ||
      a.assetDescription?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [linkableAssets, assetSearch]);

  useEffect(() => {
    if (!isAddModalOpen) {
      setSelectedAssetId('');
      setAssetSearch('');
      setDropdownOpen(false);
      setIsSubmitting(false);
      setSubmitError(null);
      setCategorySelect(RECLASSIFICATION_PRESET_CATEGORIES[0]);
      setCustomCategory('');
      setRemarks('');
    }
  }, [isAddModalOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  if (!isAddModalOpen) return null;

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !selectedAssetId) return;
    const category = categorySelect === 'Custom' ? customCategory.trim() : categorySelect;
    if (!category) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const minDelay = new Promise(resolve => setTimeout(resolve, 600));
      await Promise.all([addLinkedReclassification(selectedAssetId, category, remarks), minDelay]);
      setIsAddModalOpen(false);
    } catch (err) {
      setIsSubmitting(false);
      setSubmitError('Gagal menyimpan item: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-xl border border-outline-variant overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <h2 className="text-xl font-bold text-on-surface">Tambah Item Reclassification</h2>
          <button
            onClick={() => setIsAddModalOpen(false)}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-on-surface">Select Asset *</label>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(prev => !prev)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <span className={selectedAssetId ? 'text-on-surface' : 'text-on-surface-variant'}>
                  {selectedAsset
                    ? `${selectedAsset.assetNumber} - ${selectedAsset.assetDescription}`
                    : 'Pilih asset dari Inventory'}
                </span>
                <ChevronDown className="h-4 w-4 text-on-surface-variant shrink-0 ml-2" />
              </button>
              {/* hidden input to satisfy form required validation */}
              <input type="text" required className="sr-only" value={selectedAssetId} readOnly tabIndex={-1} />

              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-surface border border-outline-variant rounded-lg shadow-lg">
                  <div className="p-2 border-b border-outline-variant flex items-center gap-2">
                    <Search className="h-4 w-4 text-on-surface-variant shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={assetSearch}
                      onChange={e => setAssetSearch(e.target.value)}
                      placeholder="Cari asset number atau deskripsi..."
                      className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                    />
                    {assetSearch && (
                      <button type="button" onClick={() => setAssetSearch('')} className="text-on-surface-variant hover:text-on-surface">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <ul className="max-h-56 overflow-y-auto py-1">
                    {filteredAssets.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-on-surface-variant">{copy.emptyState.noResults}</li>
                    ) : (
                      filteredAssets.map(asset => (
                        <li
                          key={asset.id}
                          onClick={() => {
                            setSelectedAssetId(asset.id);
                            setDropdownOpen(false);
                            setAssetSearch('');
                          }}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-surface-container-low ${selectedAssetId === asset.id ? 'bg-primary/10 text-primary font-medium' : 'text-on-surface'}`}
                        >
                          <span className="font-medium">{asset.assetNumber}</span>
                          <span className="text-on-surface-variant"> — {asset.assetDescription}</span>
                        </li>
                      ))
                    )}
                  </ul>
                  {!assetSearch && linkableAssets.length > 50 && (
                    <p className="px-3 py-2 text-xs text-on-surface-variant border-t border-outline-variant">
                      Menampilkan 50 dari {linkableAssets.length} asset. Ketik untuk mencari.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedAsset && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant text-sm">
              <div><span className="text-on-surface-variant">Asset Class:</span> {selectedAsset.categorySegment1 || '-'}</div>
              <div><span className="text-on-surface-variant">Location:</span> {selectedAsset.categorySegment2 || '-'}</div>
              <div><span className="text-on-surface-variant">Ownership:</span> {selectedAsset.subsidiary || '-'}</div>
              <div><span className="text-on-surface-variant">Unit:</span> {selectedAsset.assetUnits || '-'}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Item Status (Klasifikasi) *</label>
              <select
                value={categorySelect}
                onChange={(e) => setCategorySelect(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {RECLASSIFICATION_PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="Custom">Custom...</option>
              </select>
            </div>
            {categorySelect === 'Custom' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-on-surface">Nama Custom *</label>
                <input
                  required
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Barang Hilang"
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-semibold text-on-surface">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Catatan tambahan (opsional)"
                rows={3}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-error bg-error-container/20 border border-error/20 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-outline-variant/30 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedAssetId}
              className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 transition-colors rounded-lg shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Simpan'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
