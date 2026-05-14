import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/get-current-user'

// GET /api/me — returns current user info for client-side header state
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
  return NextResponse.json({
    user: {
      id: user.profileId,
      email: user.email,
      displayName: user.displayName,
    },
    isAdmin: user.isAdmin,
  })
}
