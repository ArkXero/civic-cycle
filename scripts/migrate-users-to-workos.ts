/**
 * Phase 3: Bulk import civic-cycle users from Supabase into WorkOS.
 *
 * Usage:
 *   npx tsx scripts/migrate-users-to-workos.ts [--dry-run] [--send-reset]
 *
 * Flags:
 *   --dry-run     Print what would happen, make no changes.
 *   --send-reset  Send password-reset emails via WorkOS after creating each user.
 *
 * Idempotent: users with workos_user_id already set are skipped.
 * Run repeatedly until "Skipped (already migrated)" equals total user count.
 *
 * Pre-conditions:
 *   WORKOS_API_KEY, WORKOS_CLIENT_ID, SUPABASE_SERVICE_ROLE_KEY,
 *   NEXT_PUBLIC_SUPABASE_URL all set in environment (or .env.local).
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { WorkOS } from '@workos-inc/node'

const DRY_RUN = process.argv.includes('--dry-run')
const SEND_RESET = process.argv.includes('--send-reset')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const WORKOS_API_KEY = process.env.WORKOS_API_KEY!
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !WORKOS_API_KEY || !WORKOS_CLIENT_ID) {
  console.error('Missing required env vars. Check WORKOS_API_KEY, WORKOS_CLIENT_ID, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const workos = new WorkOS(WORKOS_API_KEY)

interface UserProfile {
  id: string
  email: string
  display_name: string | null
  workos_user_id: string | null
}

async function fetchAllProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, display_name, workos_user_id')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch user_profiles: ${error.message}`)
  return (data ?? []) as UserProfile[]
}

async function migrateUser(profile: UserProfile): Promise<'created' | 'existing' | 'error'> {
  // Check if WorkOS user with this email already exists
  let workosUserId: string | null = null

  try {
    const { data: existing } = await workos.userManagement.listUsers({
      email: profile.email,
      limit: 1,
    })
    if (existing.length > 0) {
      workosUserId = existing[0].id
      console.log(`  [existing] ${profile.email} → ${workosUserId}`)
    }
  } catch {
    // listUsers may throw if no results — treat as not found
  }

  if (!workosUserId) {
    // Create new WorkOS user with a random password (they'll reset it)
    const [firstName, ...rest] = (profile.display_name ?? '').split(' ')
    const lastName = rest.join(' ') || undefined

    const created = await workos.userManagement.createUser({
      email: profile.email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      emailVerified: true,
    })
    workosUserId = created.id
    console.log(`  [created ] ${profile.email} → ${workosUserId}`)
  }

  // Backfill workos_user_id in user_profiles
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ workos_user_id: workosUserId } as Record<string, unknown>)
    .eq('id', profile.id)

  if (updateError) {
    console.error(`  [error   ] Failed to backfill ${profile.email}: ${updateError.message}`)
    return 'error'
  }

  // Optionally send password reset
  if (SEND_RESET) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (workos.userManagement as any).createPasswordReset({
        email: profile.email,
        passwordResetUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://civiccycle.org'}/auth/login`,
      })
      console.log(`  [reset   ] Sent password reset to ${profile.email}`)
    } catch (err) {
      console.warn(`  [warn    ] Password reset failed for ${profile.email}: ${err}`)
    }
  }

  return workosUserId ? 'existing' : 'created'
}

async function main() {
  console.log(`\n=== WorkOS User Migration ===`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Send password resets: ${SEND_RESET ? 'YES' : 'NO'}\n`)

  const profiles = await fetchAllProfiles()
  console.log(`Found ${profiles.length} user_profiles rows.\n`)

  const already = profiles.filter(p => p.workos_user_id !== null)
  const pending = profiles.filter(p => p.workos_user_id === null)

  console.log(`Already migrated: ${already.length}`)
  console.log(`Pending:          ${pending.length}\n`)

  if (pending.length === 0) {
    console.log('All users already migrated. Done.')
    return
  }

  if (DRY_RUN) {
    console.log('DRY RUN — would migrate:')
    for (const p of pending) {
      console.log(`  ${p.email} (id: ${p.id})`)
    }
    return
  }

  let created = 0
  let existing = 0
  let errors = 0

  for (const profile of pending) {
    try {
      const result = await migrateUser(profile)
      if (result === 'created') created++
      else if (result === 'existing') existing++
      else errors++
    } catch (err) {
      console.error(`  [error   ] ${profile.email}: ${err}`)
      errors++
    }
    // Rate limit: WorkOS free tier — stay well under limits
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n=== Results ===`)
  console.log(`Created in WorkOS:  ${created}`)
  console.log(`Matched existing:   ${existing}`)
  console.log(`Errors:             ${errors}`)
  console.log(`Already migrated:   ${already.length}`)
  console.log(`Total:              ${profiles.length}`)

  if (errors > 0) {
    console.log('\nRe-run the script to retry failed users.')
    process.exit(1)
  }

  console.log('\nMigration complete. Run with --send-reset to email password resets.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
