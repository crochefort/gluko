export interface Subject {
  id: string
  name: string
  dateOfBirth?: Date
  notes?: string
  active: boolean
  created: Date
  lastModified: Date
  settings?: {
    defaultMealTags?: string[]
    carbRatios?: {
      [timeSlot: string]: number // ICR - Insulin to Carbohydrate Ratio
    }
    bolusSettings?: {
      icr: number // Default ICR (e.g., 1:10 means 1 unit per 10g carbs)
      isf?: number // Insulin Sensitivity Factor
      targetGlucose?: number // Target blood glucose level
      enableProteinFatBolus?: boolean // Whether to calculate for protein/fat
      proteinFatMethod?: 'pankowska' | 'percentage' | 'newzealand' // Method to use
      dualWavePreferences?: {
        defaultSplit: number // e.g., 60 for 60/40 split
        defaultDuration: number // duration in hours
      }
    }
  }
}

export interface CalculationSession {
  id: string
  subjectId: string
  nutrients: Nutrient[]
  created: Date
  lastModified: Date
  status: 'draft' | 'completed'
}

export interface MealHistoryEntry {
  id: string
  subjectId: string
  date: Date
  name?: string
  notes?: string
  tags: string[]
  nutrients: Nutrient[]
  totalCarbs: number
  totalProtein?: number
  totalFat?: number
  bolusCalculation?: BolusCalculation
  metadata: {
    lastModified: Date
    created: Date
    version: number
    createdFrom?: string
    calculatedBy: string
  }
  calculationDetails?: {
    methodUsed: string
    roundingApplied: boolean
    carbRatio?: number
    originalValues?: {
      totalCarbs: number
    }
  }
}

export interface BolusCalculation {
  icr: number // Insulin to Carb Ratio used
  netCarbs: number // Net carbs (carbs - fiber)
  protein: number // Total protein in grams
  fat: number // Total fat in grams

  // Immediate bolus
  carbsBolusUnits: number // Insulin units for carbs only

  // Protein/Fat bolus (if applicable)
  proteinFatBolusUnits?: number // Additional insulin units for protein/fat
  methodUsed?: 'pankowska' | 'percentage' | 'newzealand'

  // Total bolus
  totalBolusUnits: number // Total insulin units

  // Timing recommendations
  immediateBolusUnits: number // Bolus to give now
  extendedBolusUnits?: number // Bolus to give later/extended
  extendedBolusHours?: number // Duration for extended bolus
  extendedBolusDelay?: number // When to start extended bolus (hours)

  // Dual-wave split (for pump users)
  dualWaveSplit?: string // e.g., "60/40"
  dualWaveDuration?: number // Duration in hours

  calculatedAt: Date
  notes?: string
}

export interface UserAccount {
  id: string
  name: string
  email: string
  preferences: {
    defaultSubjectId?: string
    activeSubjects: string[]
    displayOrder: string[]
  }
}

export interface Nutrient {
  id: string
  name: string
  quantity: number
  factor: number
  measureId?: number
  measureName?: string
  measureNameF?: string
  unit?: string
  fiber?: number // Fiber content per 100g
  protein?: number // Protein content per 100g
  fat?: number // Fat content per 100g
  servingWeight?: number // Actual weight of the selected measure in grams
}
