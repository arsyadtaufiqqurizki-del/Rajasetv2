import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useReclassification } from '../contexts/ReclassificationContext';

export default function VerifyReclassificationModal() {
  const {
    isVerifyModalOpen, setIsVerifyModalOpen,
    verifyingReclassification, setVerifyingReclassification,
    verifyReclassification,
  } = useReclassification();

  const [isSaving, setIsSaving] = useState(false);

  if (!isVerifyModalOpen || !verifyingReclassification) return null;

  const item = verifyingReclassification;

  const handleClose = () => {
    setIsVerifyModalOpen(false);
    setVerifyingReclassification(null);
  };

  const handleToggle = async () => {
    setIsSaving(true);
    await verifyReclassification(item.id, !item.verified);
    setIsSaving(false);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl border border-outline-variant overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <h2 className="text-xl font-bold text-on-surface">Verifikasi Item</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="bg-surface-container rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-on-surface-variant">Deskripsi</span>
              <span className="font-semibold text-on-surface text-right">{item.assetDescription}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-on-surface-variant">Kategori</span>
              <span className="text-on-surface">{item.category}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-on-surface-variant">Lokasi</span>
              <span className="text-on-surface">{item.location || '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-on-surface-variant">Ownership</span>
              <span className="text-on-surface">{item.ownership || '-'}</span>
            </div>
          </div>

          <div className={
            item.verified
              ? "flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
              : "flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
          }>
            {item.verified ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-amber-600 shrink-0" />
            )}
            <div className="text-sm">
              <div className={item.verified ? "font-semibold text-emerald-800" : "font-semibold text-amber-800"}>
                {item.verified ? 'Verified' : 'Unverified'}
              </div>
              {item.verified && item.verificationDate && (
                <div className="text-xs text-emerald-700">
                  {new Date(item.verificationDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {item.verifiedBy ? ` oleh ${item.verifiedBy}` : ''}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors rounded-lg disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleToggle}
              disabled={isSaving}
              className={
                item.verified
                  ? "px-5 py-2.5 text-sm font-medium text-on-surface bg-surface-container-high hover:bg-surface-container-highest transition-colors rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
                  : "px-5 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 transition-colors rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
              }
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {item.verified ? 'Tandai Belum Terverifikasi' : 'Tandai Terverifikasi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
