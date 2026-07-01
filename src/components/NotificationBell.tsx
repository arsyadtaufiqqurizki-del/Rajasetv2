import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bell, Plus, Pencil, Trash2, Upload, Wrench, X } from 'lucide-react'
import { useActivityLog, ActivityLog } from '../hooks/useActivityLog'
import { useSystemAlerts } from '../hooks/useSystemAlerts'
import { cn } from '../lib/utils'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Kemarin'
  return `${days} hari lalu`
}

function getActionMeta(log: ActivityLog) {
  const d = log.details ?? {}
  const name = log.user_name
  switch (log.action_type) {
    case 'IMPORT_CSV':
      return {
        icon: <Upload className="h-4 w-4 text-blue-500" />,
        bg: 'bg-blue-50',
        title: `${name} mengimpor ${Number(d.success ?? 0)} aset`,
        subtitle: d.failed ? `${d.failed} baris gagal divalidasi` : 'Semua baris berhasil',
      }
    case 'ADD_ASSET':
      return {
        icon: <Plus className="h-4 w-4 text-emerald-500" />,
        bg: 'bg-emerald-50',
        title: `${name} menambahkan aset baru`,
        subtitle: String(d.assetName ?? ''),
      }
    case 'UPDATE_ASSET':
      return {
        icon: <Pencil className="h-4 w-4 text-amber-500" />,
        bg: 'bg-amber-50',
        title: `${name} memperbarui aset`,
        subtitle: String(d.assetName ?? ''),
      }
    case 'DELETE_ASSET':
      return {
        icon: <Trash2 className="h-4 w-4 text-red-500" />,
        bg: 'bg-red-50',
        title: `${name} menghapus aset`,
        subtitle: String(d.assetName ?? ''),
      }
    case 'BULK_DELETE':
      return {
        icon: <Trash2 className="h-4 w-4 text-red-500" />,
        bg: 'bg-red-50',
        title: `${name} menghapus ${Number(d.count ?? 0)} aset sekaligus`,
        subtitle: d.subsidiary ? `Dari ${d.subsidiary}` : '',
      }
    case 'ADD_MAINTENANCE':
      return {
        icon: <Wrench className="h-4 w-4 text-violet-500" />,
        bg: 'bg-violet-50',
        title: `${name} menjadwalkan maintenance`,
        subtitle: String(d.assetName ?? ''),
      }
    case 'UPDATE_MAINTENANCE':
      return {
        icon: <Wrench className="h-4 w-4 text-violet-500" />,
        bg: 'bg-violet-50',
        title: `${name} memperbarui status maintenance`,
        subtitle: d.from && d.to ? `${d.from} → ${d.to}` : String(d.assetName ?? ''),
      }
    default:
      return {
        icon: <Bell className="h-4 w-4 text-gray-400" />,
        bg: 'bg-gray-50',
        title: name,
        subtitle: log.action_type,
      }
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [openSnapshot, setOpenSnapshot] = useState<string | null>(null)
  const { logs, unreadCount, lastReadAt, loading, markAsRead } = useActivityLog()
  const { alerts, fetchAlerts } = useSystemAlerts()
  const wrapperRef = useRef<HTMLDivElement>(null)

  const totalBadge = unreadCount + alerts.length

  function handleToggle() {
    if (!open) {
      setOpenSnapshot(lastReadAt)
      setOpen(true)
      markAsRead()
      fetchAlerts()
    } else {
      setOpen(false)
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={handleToggle}
        className="relative rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
      >
        <Bell className="h-5 w-5" />
        {totalBadge > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white leading-none">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-outline-variant bg-surface shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
            <span className="text-sm font-semibold text-on-surface">Notifikasi</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {/* System alerts */}
            {alerts.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-error">
                  Peringatan Sistem
                </p>
                <div className="divide-y divide-red-100">
                  {alerts.map(alert => (
                    <div key={alert.type} className="flex gap-3 bg-red-50/60 px-4 py-3 text-sm">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-red-700 leading-snug">{alert.title}</p>
                        <p className="mt-0.5 text-xs text-red-500 truncate">{alert.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity log */}
            <div>
              {alerts.length > 0 && (
                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Aktivitas Terbaru
                </p>
              )}
              <div className="divide-y divide-outline-variant/40">
                {loading ? (
                  <p className="px-4 py-8 text-center text-sm text-on-surface-variant">Memuat...</p>
                ) : logs.length === 0 && alerts.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
                    Belum ada notifikasi
                  </p>
                ) : logs.length === 0 ? null : (
                  logs.map(log => {
                    const meta = getActionMeta(log)
                    const isUnread = !openSnapshot || new Date(log.created_at) > new Date(openSnapshot)
                    return (
                      <div
                        key={log.id}
                        className={cn(
                          'flex gap-3 px-4 py-3 text-sm',
                          isUnread ? 'bg-primary/5' : 'bg-surface'
                        )}
                      >
                        <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', meta.bg)}>
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-on-surface leading-snug">{meta.title}</p>
                          {meta.subtitle && (
                            <p className="mt-0.5 text-xs text-on-surface-variant truncate">{meta.subtitle}</p>
                          )}
                          <p className="mt-1 text-xs text-on-surface-variant/60">{timeAgo(log.created_at)}</p>
                        </div>
                        {isUnread && (
                          <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
