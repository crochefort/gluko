import type { Nutrient, BolusCalculation } from '@/types/meal-history'
import { useI18n } from 'vue-i18n'

/**
 * Composable for insulin bolus calculations based on meal content
 * Implements various methods from diabetes research for protein/fat bolus calculations
 */
export function useBolusCalculator() {
  const { t } = useI18n()

  /**
   * Calculate total macronutrients from a list of nutrients
   */
  function calculateMacronutrients(nutrients: Nutrient[]) {
    let totalNetCarbs = 0
    let totalProtein = 0
    let totalFat = 0
    let totalFiber = 0

    nutrients.forEach((nutrient) => {
      const quantity = nutrient.quantity || 0

      // Calculate net carbs (total carbs - fiber)
      const totalCarbs = quantity * nutrient.factor

      let fiberContent = 0
      let proteinContent = 0
      let fatContent = 0

      // For custom measures (measureId = -1), use quantity directly as grams
      if (nutrient.measureId === -1) {
        fiberContent = ((nutrient.fiber || 0) / 100) * quantity
        proteinContent = ((nutrient.protein || 0) / 100) * quantity
        fatContent = ((nutrient.fat || 0) / 100) * quantity
      } else {
        // For predefined measures, use servingWeight * quantity
        const servingWeight = nutrient.servingWeight || 0
        fiberContent = ((nutrient.fiber || 0) / 100) * servingWeight * quantity
        proteinContent = ((nutrient.protein || 0) / 100) * servingWeight * quantity
        fatContent = ((nutrient.fat || 0) / 100) * servingWeight * quantity
      }

      const netCarbs = Math.max(0, totalCarbs - fiberContent)

      totalNetCarbs += netCarbs
      totalProtein += proteinContent
      totalFat += fatContent
      totalFiber += fiberContent
    })

    return {
      netCarbs: totalNetCarbs,
      protein: totalProtein,
      fat: totalFat,
      fiber: totalFiber
    }
  }

  /**
   * Calculate insulin bolus using the Pankowska (Warsaw) method
   * Based on Fat-Protein Units (FPU): 1 FPU = 100 kcal from protein + fat
   */
  function calculatePankowskaMethod(
    netCarbs: number,
    protein: number,
    fat: number,
    icr: number
  ): Partial<BolusCalculation> {
    // Calculate basic carbs bolus
    const carbsBolusUnits = netCarbs / icr

    // Calculate FPU (Fat-Protein Units)
    const proteinKcal = protein * 4
    const fatKcal = fat * 9
    const totalProteinFatKcal = proteinKcal + fatKcal
    const fpuCount = totalProteinFatKcal / 100

    // Additional insulin for protein/fat (1 unit per FPU)
    const proteinFatBolusUnits = Math.round(fpuCount * 10) / 10

    // Extended bolus duration based on FPU count
    let extendedBolusHours = 3 // Default 3 hours
    if (fpuCount >= 1 && fpuCount < 2) extendedBolusHours = 3
    else if (fpuCount >= 2 && fpuCount < 3) extendedBolusHours = 4
    else if (fpuCount >= 3) extendedBolusHours = 5
    else if (fpuCount > 3) extendedBolusHours = 8

    const totalBolusUnits = carbsBolusUnits + proteinFatBolusUnits

    return {
      carbsBolusUnits,
      proteinFatBolusUnits,
      totalBolusUnits,
      immediateBolusUnits: carbsBolusUnits,
      extendedBolusUnits: proteinFatBolusUnits,
      extendedBolusHours,
      extendedBolusDelay: 0, // Start immediately
      methodUsed: 'pankowska'
    }
  }

  /**
   * Calculate insulin bolus using percentage increase method
   * For high fat (>40g) and high protein (>25g) meals
   */
  function calculatePercentageMethod(
    netCarbs: number,
    protein: number,
    fat: number,
    icr: number
  ): Partial<BolusCalculation> {
    const carbsBolusUnits = netCarbs / icr

    // Check if meal qualifies for protein/fat bolus
    const isHighFat = fat > 40
    const isHighProtein = protein > 25

    let percentageIncrease = 0
    let dualWaveSplit = '100/0' // Default: all immediate
    let dualWaveDuration = 0

    if (isHighFat && isHighProtein) {
      // High fat + high protein: 30-35% increase
      percentageIncrease = 0.3 // Conservative 30%
      dualWaveSplit = '60/40' // 60% immediate, 40% extended
      dualWaveDuration = 2.5
    } else if (isHighFat) {
      // High fat only: 30% increase
      percentageIncrease = 0.3
      dualWaveSplit = '50/50' // 50% immediate, 50% extended
      dualWaveDuration = 2.5
    } else if (isHighProtein) {
      // High protein only: 20% increase
      percentageIncrease = 0.2
      dualWaveSplit = '70/30' // 70% immediate, 30% extended
      dualWaveDuration = 2.0
    }

    const additionalInsulin = carbsBolusUnits * percentageIncrease
    const totalBolusUnits = carbsBolusUnits + additionalInsulin

    // Calculate dual-wave split
    const [immediatePct, extendedPct] = dualWaveSplit.split('/').map(Number)
    const immediateBolusUnits = (totalBolusUnits * immediatePct) / 100
    const extendedBolusUnits = (totalBolusUnits * extendedPct) / 100

    return {
      carbsBolusUnits,
      proteinFatBolusUnits: additionalInsulin,
      totalBolusUnits,
      immediateBolusUnits,
      extendedBolusUnits: extendedBolusUnits > 0 ? extendedBolusUnits : undefined,
      extendedBolusHours: dualWaveDuration > 0 ? dualWaveDuration : undefined,
      extendedBolusDelay: 0,
      dualWaveSplit,
      dualWaveDuration: dualWaveDuration > 0 ? dualWaveDuration : undefined,
      methodUsed: 'percentage'
    }
  }

  /**
   * Calculate insulin bolus using New Zealand method (for low-carb diets)
   * Suitable for diets with ≤100g carbs per day
   */
  function calculateNewZealandMethod(
    netCarbs: number,
    protein: number,
    fat: number,
    icr: number
  ): Partial<BolusCalculation> {
    const carbsBolusUnits = netCarbs / icr

    // For protein: use ICR × 2 (e.g., if ICR is 1:10, use 1:20 for protein)
    const proteinBolusUnits = protein / (icr * 2)

    // No insulin for fat in this method
    const totalBolusUnits = carbsBolusUnits + proteinBolusUnits

    return {
      carbsBolusUnits,
      proteinFatBolusUnits: proteinBolusUnits,
      totalBolusUnits,
      immediateBolusUnits: totalBolusUnits,
      extendedBolusUnits: undefined,
      extendedBolusHours: undefined,
      methodUsed: 'newzealand'
    }
  }

  /**
   * Main bolus calculation function
   */
  function calculateBolus(
    nutrients: Nutrient[],
    icr: number,
    method: 'pankowska' | 'percentage' | 'newzealand' = 'percentage'
  ): BolusCalculation {
    const macros = calculateMacronutrients(nutrients)

    let calculation: Partial<BolusCalculation>

    switch (method) {
      case 'pankowska':
        calculation = calculatePankowskaMethod(macros.netCarbs, macros.protein, macros.fat, icr)
        break
      case 'newzealand':
        calculation = calculateNewZealandMethod(macros.netCarbs, macros.protein, macros.fat, icr)
        break
      case 'percentage':
      default:
        calculation = calculatePercentageMethod(macros.netCarbs, macros.protein, macros.fat, icr)
        break
    }

    // Build complete BolusCalculation object
    const bolusCalculation: BolusCalculation = {
      icr,
      netCarbs: Math.round(macros.netCarbs * 10) / 10,
      protein: Math.round(macros.protein * 10) / 10,
      fat: Math.round(macros.fat * 10) / 10,
      carbsBolusUnits: Math.round((calculation.carbsBolusUnits || 0) * 10) / 10,
      proteinFatBolusUnits: calculation.proteinFatBolusUnits
        ? Math.round(calculation.proteinFatBolusUnits * 10) / 10
        : undefined,
      totalBolusUnits: Math.round((calculation.totalBolusUnits || 0) * 10) / 10,
      immediateBolusUnits: Math.round((calculation.immediateBolusUnits || 0) * 10) / 10,
      extendedBolusUnits: calculation.extendedBolusUnits
        ? Math.round(calculation.extendedBolusUnits * 10) / 10
        : undefined,
      extendedBolusHours: calculation.extendedBolusHours,
      extendedBolusDelay: calculation.extendedBolusDelay,
      dualWaveSplit: calculation.dualWaveSplit,
      dualWaveDuration: calculation.dualWaveDuration,
      methodUsed: calculation.methodUsed,
      calculatedAt: new Date(),
      notes: generateBolusNotes(macros, calculation, method)
    }

    return bolusCalculation
  }

  /**
   * Generate helpful notes for the bolus calculation
   */
  function generateBolusNotes(
    macros: { netCarbs: number; protein: number; fat: number; fiber: number },
    calculation: Partial<BolusCalculation>,
    method: string
  ): string {
    const notes = []

    if (macros.protein > 25) {
      notes.push(`High protein (${macros.protein.toFixed(1)}g)`)
    }
    if (macros.fat > 40) {
      notes.push(`High fat (${macros.fat.toFixed(1)}g)`)
    }
    if (calculation.extendedBolusUnits) {
      notes.push(`Extended bolus recommended`)
    }

    notes.push(`Method: ${method}`)

    return notes.join('. ')
  }

  /**
   * Get timing recommendations as human-readable text
   */
  function getTimingRecommendations(bolus: BolusCalculation): string[] {
    const recommendations = []

    recommendations.push(
      t('components.bolusCalculator.recommendations.giveNow', {
        units: bolus.immediateBolusUnits
      })
    )

    if (bolus.extendedBolusUnits && bolus.extendedBolusHours) {
      if (bolus.dualWaveSplit) {
        recommendations.push(
          t('components.bolusCalculator.recommendations.dualWave', {
            split: bolus.dualWaveSplit,
            hours: bolus.extendedBolusHours
          })
        )
      } else {
        const delay = bolus.extendedBolusDelay || 0
        const timingKey = delay > 0 ? 'afterMeal' : 'immediately'
        recommendations.push(
          t('components.bolusCalculator.recommendations.extended', {
            units: bolus.extendedBolusUnits,
            timing: t(`components.bolusCalculator.recommendations.${timingKey}`, { hours: delay }),
            hours: bolus.extendedBolusHours
          })
        )
      }
    }

    return recommendations
  }

  return {
    calculateBolus,
    calculateMacronutrients,
    getTimingRecommendations
  }
}
