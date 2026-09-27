import { getBoardDocsAgendaResponse } from '@/app/api/boarddocs/_handlers'

// Fairfax-compatible alias for one release.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  void request
  return getBoardDocsAgendaResponse('fairfax', id)
}
