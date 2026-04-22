export interface AltitudeRange { min: number; max: number }

export interface Bean {
  name?: string
  roastery?: string
  originCountry?: string
  originRegion?: string
  farm?: string
  variety?: string
  process?: string
  roastLevel?: string
  altitudeMasl?: AltitudeRange
  harvestDate?: string
  roastDate?: string
  flavorNotes: string[]
  pricePer100g?: number
  notes: string
  warnings: string[]
}

export interface BrewParameters {
  doseG?: number
  yieldG?: number
  ratio?: string
  waterTempC?: number
  brewTimeSec?: number
  grindSize?: string
  brewer?: string
  grinder?: string
  filter?: string
}

export type Step =
  | { type: 'text'; value: string }
  | { type: 'note'; value: string }
  | { type: 'waterPour'; name?: string; amountG: number; cumulative: boolean; tempC?: number; sequence: number }
  | { type: 'timer'; name?: string; totalSecs: number }
  | { type: 'grindSpec'; description: string }
  | { type: 'technique'; name: string; detail?: string }
  | { type: 'equipment'; name: string; detail?: string }
  | { type: 'beanRef'; name: string; amountG?: number }
  | { type: 'inlineMetadata'; key: string; value: string }

export interface Section { name?: string; steps: Step[] }

export interface Recipe {
  title?: string
  beanRef?: string
  bean?: Bean
  brewMethod?: string
  brew?: BrewParameters
  sections: Section[]
  warnings: string[]
}

export const VALID_PROCESSES = [
  'washed', 'natural', 'honey', 'anaerobic natural', 'anaerobic washed',
  'carbonic maceration', 'extended fermentation', 'double fermented',
  'lactic fermentation', 'koji fermentation', 'wine process',
  'thermal shock', 'wet-hulled',
] as const

export const VALID_ROAST_LEVELS = [
  'ultra light', 'light', 'light-medium', 'medium',
  'medium-dark', 'dark', 'very dark',
] as const

export function isValidProcess(s: string): boolean {
  return VALID_PROCESSES.some(v => v.toLowerCase() === s.toLowerCase())
}

export function isValidRoastLevel(s: string): boolean {
  return VALID_ROAST_LEVELS.some(v => v.toLowerCase() === s.toLowerCase())
}
