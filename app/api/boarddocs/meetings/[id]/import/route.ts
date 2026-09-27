import { importBoardDocsMeetingResponse } from '@/app/api/boarddocs/_handlers'

// Fairfax-compatible alias for one release.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  void request
  return importBoardDocsMeetingResponse('fairfax', id)
}
