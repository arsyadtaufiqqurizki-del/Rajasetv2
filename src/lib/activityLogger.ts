import { supabase } from './supabase'

export type ActionType =
  | 'IMPORT_CSV'
  | 'ADD_ASSET'
  | 'UPDATE_ASSET'
  | 'DELETE_ASSET'
  | 'BULK_DELETE'
  | 'ADD_MAINTENANCE'
  | 'UPDATE_MAINTENANCE'

export type EntityType = 'asset' | 'maintenance' | 'system'

interface LogActivityParams {
  actionType: ActionType
  entityType?: EntityType
  entityId?: string
  details?: Record<string, unknown>
}

export async function logActivity({
  actionType,
  entityType,
  entityId,
  details,
}: LogActivityParams): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const userName = user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || 'Unknown User'

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: userName,
    action_type: actionType,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    details: details ?? null,
  })
}
