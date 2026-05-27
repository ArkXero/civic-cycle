import { importBoardDocsMeetingResponse } from '@/app/api/boarddocs/_handlers'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ districtId: string; id: string }> }
) {
  const { districtId, id } = await params
  void request
  return importBoardDocsMeetingResponse(districtId, id)
}
