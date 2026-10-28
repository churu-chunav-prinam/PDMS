import { History } from 'lucide-react';
import { apiGet } from '../../api/client';
import type { HistoryEvent } from '../../api/types';
import { Timeline } from '../../components/Timeline';
import { ErrorBox, useLoad } from '../../components/ui';
import { OfficerLayout } from '../../layout/OfficerLayout';
import { EmptyState, SkeletonList } from '../../ui';

export function HistoryPage() {
  const { data, error } = useLoad(() => apiGet<{ events: HistoryEvent[] }>('/api/officer/history').then((r) => r.events), []);
  return (
    <OfficerLayout title="मेरा इतिहास" subtitle="My history" back="/">
      <ErrorBox error={error} />
      {!data && !error && <SkeletonList rows={4} />}
      {data?.length === 0 && <EmptyState icon={History} title="अभी कुछ दर्ज नहीं" />}
      {data && data.length > 0 && <Timeline events={data} />}
    </OfficerLayout>
  );
}
