import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { getSchoolDistrict, type SchoolDistrictId } from '@/lib/school-districts'

export function ViewingDistrict({ districtId }: { districtId: SchoolDistrictId }) {
  const district = getSchoolDistrict(districtId)

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
      <MapPin className="h-4 w-4 text-primary" />
      <span>Viewing {district.uiLabel}</span>
      <Link href="/settings" className="font-medium text-primary hover:underline">
        Change
      </Link>
    </div>
  )
}
