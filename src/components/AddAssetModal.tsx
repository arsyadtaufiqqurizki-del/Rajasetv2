import { useAsset } from '../contexts/AssetContext';
import FormModal from './ui/FormModal';
import AssetFormFields from './AssetFormFields';
import { EMPTY_ASSET_FORM, toAssetPayload } from '../lib/assetForm';
import { useEntityForm } from '../hooks/useEntityForm';

const TITLE_ID = 'add-asset-modal-title';

export default function AddAssetModal() {
  const { isAddModalOpen, setIsAddModalOpen, addAsset, subsidiaries, categories1, categories2, itemStatuses } = useAsset();

  const form = useEntityForm({
    initialValues: EMPTY_ASSET_FORM,
    // Opening or closing clears the spinner and the banner. No `seed`, so the typed
    // values survive a Cancel — reopening shows the form as the user left it. Only a
    // successful save blanks it, below.
    resetKey: isAddModalOpen,
    errorPrefix: 'Failed to save asset',
  });

  const handleClose = () => {
    if (form.isSaving) return;
    setIsAddModalOpen(false);
  };

  const handleSubmit = form.handleSubmit(async values => {
    await addAsset(toAssetPayload(values));
    setIsAddModalOpen(false);
    form.setValues(EMPTY_ASSET_FORM);
  });

  return (
    <FormModal
      isOpen={isAddModalOpen}
      titleId={TITLE_ID}
      title="Add New Asset"
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel="Save Asset"
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
