import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ActivityLog {
  id: string
  user_id: string | null
  user_name: string
  action_type: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export function useActivityLog() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const [logsRes, { data: { user } }] = await Promise.all([
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.auth.getUser(),
      ])
      if (logsRes.data) setLogs(logsRes.data)

      if (user) {
        const { data } = await supabase
          .from('notification_reads')
          .select('last_read_at')
          .eq('user_id', user.id)
          .single()
        if (data) setLastReadAt(data.last_read_at)
      }
      setLoading(false)
    }
    init()

    const channel = supabase
      .channel('activity_logs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setLogs(prev => [payload.new as ActivityLog, ...prev].slice(0, 20))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const markAsRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date().toISOString()
    await supabase.from('notification_reads').upsert({ user_id: user.id, last_read_at: now })
    setLastReadAt(now)
  }, [])

  const unreadCount = logs.filter(log =>
    !lastReadAt || new Date(log.created_at) > new Date(lastReadAt)
  ).length

  return { logs, unreadCount, lastReadAt, loading, markAsRead }
}
