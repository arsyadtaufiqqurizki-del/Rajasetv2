import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  emptyAddMaintenanceForm,
  emptyMaintenanceForm,
  recordToFormValues,
  toMaintenancePayload,
  toMaintenanceUpdate,
} from './maintenanceForm';
import type { Asset } from '../types/asset';
import type { MaintenanceRecord } from '../types/maintenance';

const ASSET: Asset = {
  id: 'a1',
  assetBook: 'Corporate',
  subsidiary: 'PT Raja Prima',
  assetNumber: 'AST-001',
  assetDescription: 'Excavator',
  assetCost: '1,000',
  datePlaceInService: '2026-01-01',
  assetUnits: '2',
  categorySegment1: 'Heavy Equipment',
  categorySegment2: 'Site A',
  depreciationMethod: 'Straight Line',
  lifeInMonths: '60',
  listed: 'Non-Listed',
  status: 'Active',
  statusLevel: 'success',
  verification: false,
  verificationDate: '',
  itemStatus: 'Asset',
  createdAt: '2026-01-01',
};

const RECORD: MaintenanceRecord = {
  id: 'm1',
  assetBook: 'Corporate',
  subsidiary: 'PT Raja Prima',
  assetNumber: 'AST-001',
  assetDescription: 'Excavator',
  assetUnits: '2',
  serviceType: 'Oil Change',
  assetCategorySegment1: 'Heavy Equipment',
  assetCategorySegment2: 'Site A',
  estimateCost: '$500.00',
  actualCost: '$450.00',
  status: 'In Progress',
  scheduledDate: '2026-10-01',
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T03:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('emptyMaintenanceForm', () => {
  it('opens on Pending with today as the scheduled date', () => {
    expect(emptyMaintenanceForm()).toEqual({
      serviceType: '',
      estimateCost: '',
      actualCost: '',
      status: 'Pending',
      scheduledDate: '2026-09-10',
    });
  });

  it('reads the clock on every call, not once at import time', () => {
    const first = emptyMaintenanceForm();
    vi.setSystemTime(new Date('2026-09-11T03:00:00.000Z'));
    expect(emptyMaintenanceForm().scheduledDate).toBe('2026-09-11');
    expect(first.scheduledDate).toBe('2026-09-10');
  });

  it('adds a blank asset id for the Add form', () => {
    expect(emptyAddMaintenanceForm()).toEqual({ assetId: '', ...emptyMaintenanceForm() });
  });
});

describe('recordToFormValues', () => {
  it('copies the five editable fields off the stored row', () => {
    expect(recordToFormValues(RECORD)).toEqual({
      serviceType: 'Oil Change',
      estimateCost: '$500.00',
      actualCost: '$450.00',
      status: 'In Progress',
      scheduledDate: '2026-10-01',
    });
  });

  it('falls back to Pending and today when the row stores neither', () => {
    const values = recordToFormValues({ ...RECORD, status: '', scheduledDate: '' });
    expect(values.status).toBe('Pending');
    expect(values.scheduledDate).toBe('2026-09-10');
  });

  it('turns a missing cost into an empty string rather than undefined', () => {
    const values = recordToFormValues({ ...RECORD, estimateCost: '', actualCost: '' });
    expect(values.estimateCost).toBe('');
    expect(values.actualCost).toBe('');
  });

  it('leaves the identity fields out — Edit never writes them', () => {
    expect(Object.keys(recordToFormValues(RECORD)).sort()).toEqual(
      ['actualCost', 'estimateCost', 'scheduledDate', 'serviceType', 'status'],
    );
  });
});

describe('toMaintenancePayload', () => {
  it('copies the identity half off the asset and the service half off the form', () => {
    expect(toMaintenancePayload(ASSET, recordToFormValues(RECORD))).toEqual({
      assetBook: 'Corporate',
      subsidiary: 'PT Raja Prima',
      assetNumber: 'AST-001',
      assetDescription: 'Excavator',
      assetUnits: '2',
      serviceType: 'Oil Change',
      assetCategorySegment1: 'Heavy Equipment',
      assetCategorySegment2: 'Site A',
      estimateCost: '$500.00',
      actualCost: '$450.00',
      status: 'In Progress',
      scheduledDate: '2026-10-01',
    });
  });

  it('falls back to the asset id when the asset has no book', () => {
    const payload = toMaintenancePayload({ ...ASSET, assetBook: '' }, emptyMaintenanceForm());
    expect(payload.assetBook).toBe('a1');
  });

  it('never carries an id — the row does not exist yet', () => {
    expect(toMaintenancePayload(ASSET, emptyMaintenanceForm())).not.toHaveProperty('id');
  });
});

describe('toMaintenanceUpdate', () => {
  it('writes the five edited fields over the stored row', () => {
    const values = { ...recordToFormValues(RECORD), serviceType: 'Full Service', status: 'Completed' };
    expect(toMaintenanceUpdate(RECORD, values)).toEqual({
      ...RECORD,
      serviceType: 'Full Service',
      status: 'Completed',
    });
  });

  it('keeps the id in the payload — that is what updateRecord has always been handed', () => {
    expect(toMaintenanceUpdate(RECORD, emptyMaintenanceForm())).toHaveProperty('id', 'm1');
  });

  it('leaves the identity fields untouched even when the form is blank', () => {
    const payload = toMaintenanceUpdate(RECORD, emptyMaintenanceForm());
    expect(payload.assetNumber).toBe('AST-001');
    expect(payload.subsidiary).toBe('PT Raja Prima');
    expect(payload.serviceType).toBe('');
  });

  it('round-trips a record through the form without changing what is stored', () => {
    expect(toMaintenanceUpdate(RECORD, recordToFormValues(RECORD))).toEqual(RECORD);
  });
});
