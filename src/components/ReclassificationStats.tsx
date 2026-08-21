import { ClipboardList, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import StatCard from './ui/StatCard';
import { id as copy } from '../i18n/id';

interface ReclassificationStatsProps {
  total: number;
  verified: number;
  unverified: number;
  needsReview: number;
}

export default function ReclassificationStats({ total, verified, unverified, needsReview }: ReclassificationStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        label="Total Item"
        value={total}
        icon={<ClipboardList className="h-5 w-5 text-primary" />}
        footer={total === 0 ? copy.emptyState.noDataFooter : 'Total temuan tercatat'}
      />
      <StatCard
        label="Verified"
        value={verified}
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        footer={total === 0 ? copy.emptyState.noDataFooter : `${Math.round((verified / total) * 100)}% dari total`}
      />
      <StatCard
        label="Unverified"
        value={unverified}
        icon={<XCircle className="h-5 w-5 text-amber-600" />}
        footer={total === 0 ? copy.emptyState.noDataFooter : 'Menunggu verifikasi'}
      />
      <StatCard
        label="Needs Review"
        value={needsReview}
        icon={<AlertTriangle className="h-5 w-5 text-error" />}
        tone="danger"
        valueClassName={needsReview > 0 ? 'text-error' : 'text-on-surface'}
        footer={needsReview === 0 ? copy.emptyState.noDataFooter : 'Perlu ditinjau ulang'}
      />
    </div>
  );
}
