import { useAsset } from '../contexts/AssetContext';
import MasterDataPanel from '../components/MasterDataPanel';

export default function MasterData() {
  const {
    subsidiaries, addSubsidiary, deleteSubsidiary,
    categories1, addCategory1, deleteCategory1,
    categories2, addCategory2, deleteCategory2
  } = useAsset();

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-[180px])] min-h-[600px] overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Master Data</h1>
        <p className="text-on-surface-variant mt-1 text-sm">Manage system-wide data entities like Subsidiaries and Categories.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MasterDataPanel
          title="Subsidiaries"
          items={subsidiaries}
          onAdd={addSubsidiary}
          onDelete={deleteSubsidiary}
          placeholder="New subsidiary..."
          emptyMessage="No subsidiaries configured"
        />
        <MasterDataPanel
          title="Asset Class"
          items={categories1}
          onAdd={addCategory1}
          onDelete={deleteCategory1}
          placeholder="New category 1..."
          emptyMessage="No categories configured"
        />
        <MasterDataPanel
          title="Location"
          items={categories2}
          onAdd={addCategory2}
          onDelete={deleteCategory2}
          placeholder="New category 2..."
          emptyMessage="No categories configured"
        />
      </div>
    </div>
  );
}
