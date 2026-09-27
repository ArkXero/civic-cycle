import { getBoardDocsAgendaResponse } from '@/app/api/boarddocs/_handlers'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ districtId: string; id: string }> }
) {
  const { districtId, id } = await params
  void request
  return getBoardDocsAgendaResponse(districtId, id)
}
