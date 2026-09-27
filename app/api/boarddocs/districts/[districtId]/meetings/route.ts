import { getBoardDocsMeetingsResponse } from '@/app/api/boarddocs/_handlers'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ districtId: string }> }
) {
  const { districtId } = await params
  void request
  return getBoardDocsMeetingsResponse(districtId)
}
