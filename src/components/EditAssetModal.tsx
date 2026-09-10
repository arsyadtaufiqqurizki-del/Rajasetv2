import { useAsset } from '../contexts/AssetContext';
import FormModal from './ui/FormModal';
import AssetFormFields from './AssetFormFields';
import { EMPTY_ASSET_FORM, assetToFormValues, toAssetPayload } from '../lib/assetForm';
import { useEntityForm } from '../hooks/useEntityForm';

const TITLE_ID = 'edit-asset-modal-title';

export default function EditAssetModal() {
  const { isEditModalOpen, setIsEditModalOpen, updateAsset, editingAsset, setEditingAsset, subsidiaries, categories1, categories2, itemStatuses } = useAsset();

  const form = useEntityForm({
    // Only reached when the modal is opened without a row; the early return below
    // means the blank form is never rendered.
    initialValues: EMPTY_ASSET_FORM,
    resetKey: editingAsset,
    // Re-hydrating on every row change, and on mount when a row is already picked.
    // Clearing the row (after a save, or on Cancel) seeds nothing, so the fields
    // are left as they were while the modal unmounts.
    seed: () => (editingAsset ? assetToFormValues(editingAsset) : null),
    errorPrefix: 'Failed to update asset',
  });

  if (!editingAsset) return null;

  const handleClose = () => {
    if (form.isSaving) return;
    setIsEditModalOpen(false);
    setEditingAsset(null);
  };

  const handleSubmit = form.handleSubmit(async values => {
    await updateAsset(editingAsset.id, toAssetPayload(values));
    setIsEditModalOpen(false);
    setEditingAsset(null);
  });

  return (
    <FormModal
      isOpen={isEditModalOpen}
      titleId={TITLE_ID}
      title="Edit Asset"
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel="Update Asset"
      isSaving={form.isSaving}
      error={form.saveError}
    >
      <AssetFormFields
        form={form}
        subsidiaries={subsidiaries}
        categories1={categories1}
        categories2={categories2}
        itemStatuses={itemStatuses}
      />
    </FormModal>
  );
}
