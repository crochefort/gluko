<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBolusCalculator } from '@/composables/useBolusCalculator'
import type { Nutrient, BolusCalculation } from '@/types/meal-history'

const props = defineProps<{
  nutrients: Nutrient[]
  icr?: number // Insulin to Carb Ratio
  method?: 'pankowska' | 'percentage' | 'newzealand'
  showDetails?: boolean
}>()

const { t } = useI18n()
const { calculateBolus, getTimingRecommendations } = useBolusCalculator()

const defaultICR = ref(10) // Default ICR of 1:10
const showAdvanced = ref(false)

// Calculate bolus when props change
const bolusCalculation = computed((): BolusCalculation | null => {
  if (!props.nutrients.length) return null

  const icr = props.icr || defaultICR.value
  const method = props.method || 'percentage'

  return calculateBolus(props.nutrients, icr, method)
})

// Get timing recommendations
const timingRecommendations = computed(() => {
  if (!bolusCalculation.value) return []
  return getTimingRecommendations(bolusCalculation.value)
})

// Check if protein/fat bolus is needed
const needsExtendedBolus = computed(() => {
  return bolusCalculation.value?.extendedBolusUnits && bolusCalculation.value.extendedBolusUnits > 0
})

// Format bolus method name for display
const methodDisplayName = computed(() => {
  switch (props.method || 'percentage') {
    case 'pankowska':
      return 'Warsaw (Pankowska)'
    case 'newzealand':
      return 'New Zealand'
    case 'percentage':
    default:
      return 'Percentage Method'
  }
})
</script>

<template>
  <div v-if="bolusCalculation" class="bolus-calculator card">
    <div class="card-header d-flex justify-content-between align-items-center">
      <h2 class="mb-0 h5 text-dark">
        <i class="bi bi-calculator me-2"></i>
        {{ t('components.bolusCalculator.title') }}
      </h2>
      <button
        v-if="showDetails"
        type="button"
        class="btn btn-outline-primary btn-sm"
        @click="showAdvanced = !showAdvanced"
      >
        <i :class="showAdvanced ? 'bi bi-chevron-up' : 'bi bi-chevron-down'"></i>
        {{ showAdvanced ? t('common.actions.hide') : t('common.actions.details') }}
      </button>
    </div>

    <div class="card-body">
      <!-- Main Bolus Information -->
      <div class="row mb-3">
        <div class="col-md-6">
          <h3 class="h6">{{ t('components.bolusCalculator.immediateBolusTitle') }}</h3>
          <div class="display-6 text-primary fw-bold">
            {{ bolusCalculation.immediateBolusUnits.toFixed(1) }}
            {{ t('components.bolusCalculator.units') }}
          </div>
          <small class="text-muted">{{ t('components.bolusCalculator.giveNow') }}</small>
        </div>

        <div v-if="needsExtendedBolus" class="col-md-6">
          <h3 class="h6">{{ t('components.bolusCalculator.extendedBolusTitle') }}</h3>
          <div class="display-6 text-warning fw-bold">
            {{ bolusCalculation.extendedBolusUnits?.toFixed(1) || 0 }}
            {{ t('components.bolusCalculator.units') }}
          </div>
          <small class="text-muted">
            {{ t('components.bolusCalculator.extendedOver') }}
            {{ bolusCalculation.extendedBolusHours }}h
          </small>
        </div>
      </div>

      <!-- Dual Wave Information -->
      <div v-if="bolusCalculation.dualWaveSplit" class="alert alert-info">
        <i class="bi bi-info-circle me-2"></i>
        <strong>{{ t('components.bolusCalculator.dualWave') }}:</strong>
        {{ bolusCalculation.dualWaveSplit }}
        {{ t('components.bolusCalculator.splitOver') }}
        {{ bolusCalculation.dualWaveDuration }}h
      </div>

      <!-- Timing Recommendations -->
      <div class="mb-3">
        <h3 class="h6">{{ t('components.bolusCalculator.recommendations.title') }}</h3>
        <ul class="list-unstyled">
          <li v-for="(recommendation, index) in timingRecommendations" :key="index" class="mb-1">
            <i class="bi bi-clock me-2 text-primary"></i>
            {{ recommendation }}
          </li>
        </ul>
      </div>

      <!-- Advanced Details -->
      <div v-if="showAdvanced && showDetails" class="mt-3">
        <hr />
        <div class="row">
          <div class="col-md-4">
            <h3 class="h6">{{ t('components.bolusCalculator.macronutrients') }}</h3>
            <ul class="list-unstyled">
              <li>
                {{ t('components.bolusCalculator.netCarbs') }}:
                {{ bolusCalculation.netCarbs.toFixed(1) }}g
              </li>
              <li>
                {{ t('components.bolusCalculator.protein') }}:
                {{ bolusCalculation.protein.toFixed(1) }}g
              </li>
              <li>
                {{ t('components.bolusCalculator.fat') }}: {{ bolusCalculation.fat.toFixed(1) }}g
              </li>
            </ul>
          </div>

          <div class="col-md-4">
            <h3 class="h6">{{ t('components.bolusCalculator.calculations') }}</h3>
            <ul class="list-unstyled">
              <li>{{ t('components.bolusCalculator.icr') }}: 1:{{ bolusCalculation.icr }}</li>
              <li>
                {{ t('components.bolusCalculator.carbsBolus') }}:
                {{ bolusCalculation.carbsBolusUnits.toFixed(1) }}u
              </li>
              <li v-if="bolusCalculation.proteinFatBolusUnits">
                {{ t('components.bolusCalculator.proteinFatBolus') }}:
                {{ bolusCalculation.proteinFatBolusUnits.toFixed(1) }}u
              </li>
            </ul>
          </div>

          <div class="col-md-4">
            <h3 class="h6">{{ t('components.bolusCalculator.method') }}</h3>
            <p class="small">{{ methodDisplayName }}</p>
            <p v-if="bolusCalculation.notes" class="small text-muted">
              {{ bolusCalculation.notes }}
            </p>
          </div>
        </div>
      </div>

      <!-- Warning for high protein/fat -->
      <div
        v-if="(bolusCalculation.protein > 25 || bolusCalculation.fat > 40) && !needsExtendedBolus"
        class="alert alert-warning"
      >
        <i class="bi bi-exclamation-triangle me-2"></i>
        {{ t('components.bolusCalculator.highProteinFatWarning') }}
      </div>
    </div>
  </div>

  <!-- No calculation available -->
  <div v-else class="alert alert-light">
    <i class="bi bi-info-circle me-2"></i>
    {{ t('components.bolusCalculator.noCalculation') }}
  </div>
</template>

<style scoped>
.bolus-calculator {
  border: 2px solid #dee2e6;
}

.bolus-calculator .card-header {
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.display-6 {
  font-size: 1.75rem;
}

.alert {
  margin-bottom: 1rem;
}

.alert:last-child {
  margin-bottom: 0;
}
</style>
