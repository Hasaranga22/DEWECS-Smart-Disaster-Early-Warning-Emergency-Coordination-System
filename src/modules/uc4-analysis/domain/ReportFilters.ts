export type HazardType = 'FLOOD' | 'LANDSLIDE' | 'CYCLONE' | 'DROUGHT' | 'OTHER'

export type IncludedSection =
  | 'ALERTS'
  | 'REACH'
  | 'REPORTS'
  | 'SHELTERS'
  | 'SUPPLIES'

export type Language = 'EN' | 'SI' | 'TA'

export interface ReportFilters {
  from: Date
  to: Date
  districtId?: string
  hazardType?: HazardType
  includedSections: IncludedSection[]
  language: Language
}
