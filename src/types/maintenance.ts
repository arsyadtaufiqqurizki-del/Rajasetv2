// Not yet applied to MaintenanceRecord.status (still `string`) — see refactoring_plan.md Step 10.
export type MaintenanceStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue';

export type MaintenanceRecord = {
  id: string;
  assetBook: string;
  subsidiary: string;
  assetNumber: string;
  assetDescription: string;
  assetUnits: string;
  serviceType: string;
  assetCategorySegment1: string;
  assetCategorySegment2: string;
  estimateCost: string;
  actualCost: string;
  status: string;
  scheduledDate: string;
};

export type MaintenanceInput = Omit<MaintenanceRecord, 'id'>;
