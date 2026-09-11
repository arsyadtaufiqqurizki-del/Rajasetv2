import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { en as copy } from '../i18n/en'

export interface SystemAlert {
  type: 'MAINTENANCE_OVERDUE' | 'BROKEN_ASSETS'
  severity: 'error'
  title: string
  subtitle: string
}

export function useSystemAlerts() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([])

  const fetchAlerts = useCallback(async () => {
    const newAlerts: SystemAlert[] = []

    const [overdueRes, totalRes, brokenRes] = await Promise.all([
      supabase
        .from('maintenance_records')
        .select('asset_description', { count: 'exact' })
        .eq('status', 'Overdue')
        .limit(3),
      supabase
        .from('assets')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('assets')
        .select('*', { count: 'exact', head: true })
        .or('status.ilike.%service%,status.ilike.broken'),
    ])

    const overdueCount = overdueRes.count ?? 0
    if (overdueCount > 0) {
      const names = (overdueRes.data ?? []).map((r: { asset_description?: unknown }) => r.asset_description).filter(Boolean)
      const preview = names.slice(0, 2).join(', ') + (overdueCount > 2 ? copy.alerts.overdueMoreSuffix(overdueCount - 2) : '')
      newAlerts.push({
        type: 'MAINTENANCE_OVERDUE',
        severity: 'error',
        title: `${overdueCount} maintenance overdue`,
        subtitle: preview || copy.alerts.overdueFallback,
      })
    }

    const total = totalRes.count ?? 0
    const broken = brokenRes.count ?? 0
    if (total > 0 && broken > 0) {
      const pct = Math.round((broken / total) * 100)
      if (pct > 10) {
        newAlerts.push({
          type: 'BROKEN_ASSETS',
          severity: 'error',
          title: copy.alerts.brokenTitle(pct),
          subtitle: copy.alerts.brokenSubtitle(broken, total),
        })
      }
    }

    setAlerts(newAlerts)
  }, [])

  // Fetch-on-mount: intentional external sync. State settles after the awaited
  // Supabase calls inside fetchAlerts, not synchronously in this effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, see above
  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  return { alerts, fetchAlerts }
}
