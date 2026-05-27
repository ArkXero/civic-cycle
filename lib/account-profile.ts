import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  DEFAULT_SCHOOL_DISTRICT_ID,
  isSchoolDistrictId,
  parseSchoolDistrictId,
  type SchoolDistrictId,
} from '@/lib/school-districts'

type DBClient = SupabaseClient<Database>

export interface AccountProfile {
  email: string
  preferredDistrictId: SchoolDistrictId | null
}

export function chooseCountyRedirectPath(redirectTo: string) {
  return `/settings?reason=choose-county&redirectTo=${encodeURIComponent(redirectTo)}`
}

export async function getAuthenticatedUser(supabase: DBClient): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getAccountProfile(
  supabase: DBClient,
  user: User
): Promise<AccountProfile> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('user_profiles')
    .select('email, preferred_district_id')
    .eq('id', user.id)
    .maybeSingle() as {
      data: { email: string; preferred_district_id: string | null } | null
    }

  const preferredDistrictId = data?.preferred_district_id
  return {
    email: data?.email || user.email || '',
    preferredDistrictId: isSchoolDistrictId(preferredDistrictId)
      ? preferredDistrictId
      : null,
  }
}

export async function getPreferredDistrictId(
  supabase: DBClient,
  explicitDistrictId?: string | null
): Promise<SchoolDistrictId> {
  if (isSchoolDistrictId(explicitDistrictId)) {
    return explicitDistrictId
  }

  const user = await getAuthenticatedUser(supabase)
  if (!user) {
    return DEFAULT_SCHOOL_DISTRICT_ID
  }

  const profile = await getAccountProfile(supabase, user)
  return profile.preferredDistrictId ?? DEFAULT_SCHOOL_DISTRICT_ID
}

export function normalizePreferredDistrictId(
  districtId: unknown
): SchoolDistrictId {
  return parseSchoolDistrictId(districtId, DEFAULT_SCHOOL_DISTRICT_ID)
}
