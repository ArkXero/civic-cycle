import { getBoardDocsMeetingsResponse } from '@/app/api/boarddocs/_handlers'

// Fairfax-compatible alias for one release.
export async function GET() {
  return getBoardDocsMeetingsResponse('fairfax')
}
