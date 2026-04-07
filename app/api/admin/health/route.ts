import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/is-admin'

interface ServiceCheck {
  service: string
  status: 'healthy' | 'down'
  responseTime: number
  error?: string
}

async function checkService(
  name: string,
  checkFn: () => Promise<void>
): Promise<ServiceCheck> {
  const start = Date.now()
  try {
    await checkFn()
    return { service: name, status: 'healthy', responseTime: Date.now() - start }
  } catch (error) {
    return {
      service: name,
      status: 'down',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = createAdminClient()

  const [dbCheck, boarddocsCheck, claudeCheck, resendCheck] = await Promise.all([
    checkService('database', async () => {
      const { error } = await adminClient
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .limit(1)
      if (error) throw new Error(error.message)
    }),
    checkService('boarddocs', async () => {
      const state = process.env.BOARDDOCS_STATE ?? 'vsba'
      const district = process.env.BOARDDOCS_DISTRICT ?? 'fairfax'
      const res = await fetch(
        `https://go.boarddocs.com/${state}/${district}/Board.nsf/vpublic`,
        { method: 'HEAD', signal: AbortSignal.timeout(5000) }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }),
    checkService('claude_api', async () => {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('API key not configured')
    }),
    checkService('resend', async () => {
      if (!process.env.RESEND_API_KEY) throw new Error('Not configured')
    }),
  ])

  const services = [dbCheck, boarddocsCheck, claudeCheck, resendCheck]

  const { data: lastImport } = await adminClient
    .from('meetings')
    .select('created_at, title')
    .eq('status', 'summarized')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    services,
    lastSuccessfulImport: lastImport ?? null,
    allHealthy: services.every((s) => s.status === 'healthy'),
  })
}
