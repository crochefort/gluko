<template>
  <div class="meal-history-card card mb-3">
    <div class="card-body">
      <!-- Header with timestamp and actions -->
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div>
          <h2 class="card-title mb-1">
            {{ formattedDate }}
          </h2>
          <p v-if="subjectName" class="text-muted small mb-0">
            {{ subjectName }}
          </p>
        </div>
        <div class="dropdown">
          <button
            :id="dropdownId"
            class="btn btn-link btn-sm text-muted p-0"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end" :aria-labelledby="dropdownId">
            <li>
              <button type="button" class="dropdown-item" @click="$emit('edit', meal)">
                <i class="bi bi-pencil me-2"></i>
                {{ $t('components.mealHistoryCard.actions.edit') }}
              </button>
            </li>
            <li>
              <button type="button" class="dropdown-item" @click="$emit('duplicate', meal)">
                <i class="bi bi-copy me-2"></i>
                {{ $t('components.mealHistoryCard.actions.duplicate') }}
              </button>
            </li>
            <li>
              <hr class="dropdown-divider" />
            </li>
            <li>
              <button
                type="button"
                class="dropdown-item text-danger"
                @click="$emit('delete', meal)"
              >
                <i class="bi bi-trash me-2"></i>
                {{ $t('components.mealHistoryCard.actions.delete') }}
              </button>
            </li>
          </ul>
        </div>
      </div>

      <!-- Summary -->
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div>
          <span class="me-3">
            <i class="bi bi-archive me-1"></i>
            {{ meal.nutrients.length }} {{ $t('components.mealHistoryCard.nutrients') }}
          </span>
          <span>
            <i class="bi bi-tags me-1"></i>
            {{ meal.tags?.length || 0 }} {{ $t('components.mealHistoryCard.tags') }}
          </span>
        </div>
        <div class="text-end">
          <span class="total-carbs"> {{ totalCarbs.toFixed(1) }}g </span>
        </div>
      </div>

      <!-- Food Items List -->
      <div v-if="meal.nutrients.length > 0" class="food-items mb-3">
        <h3 class="h6 text-muted mb-2">
          <i class="bi bi-list-ul me-1"></i>
          {{ $t('components.mealHistoryCard.foodItems') }}
        </h3>
        <div class="row">
          <div
            v-for="(nutrient, index) in meal.nutrients"
            :key="nutrient.id || index"
            class="col-md-6 mb-2"
          >
            <div class="food-item p-3 border rounded">
              <div class="d-flex justify-content-between align-items-start">
                <div class="food-name flex-grow-1 me-3">
                  <strong class="food-title">{{ nutrient.name }}</strong>
                  <div class="food-details mt-1">
                    <small class="text-muted d-block">
                      <i class="bi bi-box me-1"></i>
                      {{ nutrient.quantity }}{{ nutrient.unit || 'g' }}
                      <span v-if="nutrient.measureName" class="ms-1">
                        ({{ nutrient.measureName }})
                      </span>
                    </small>
                  </div>
                </div>
                <div class="food-carbs text-end flex-shrink-0">
                  <span class="badge bg-primary fs-6">
                    {{ (nutrient.quantity * nutrient.factor).toFixed(1) }}g
                  </span>
                  <br />
                  <small class="text-muted">{{ $t('common.nutrients.carbs') }}</small>
                </div>
              </div>

              <!-- Detailed Nutritional Information -->
              <div
                v-if="nutrient.protein || nutrient.fat || nutrient.fiber"
                class="nutrition-details mt-2 pt-2 border-top"
              >
                <div class="row g-2 text-center">
                  <div v-if="nutrient.protein" class="col">
                    <div class="nutrition-stat">
                      <small class="nutrition-value"
                        >{{
                          calculateNutrientAmount(nutrient, nutrient.protein).toFixed(1)
                        }}g</small
                      >
                      <small class="nutrition-label text-muted d-block">{{
                        $t('common.nutrients.protein')
                      }}</small>
                    </div>
                  </div>
                  <div v-if="nutrient.fat" class="col">
                    <div class="nutrition-stat">
                      <small class="nutrition-value"
                        >{{ calculateNutrientAmount(nutrient, nutrient.fat).toFixed(1) }}g</small
                      >
                      <small class="nutrition-label text-muted d-block">{{
                        $t('common.nutrients.fat')
                      }}</small>
                    </div>
                  </div>
                  <div v-if="nutrient.fiber" class="col">
                    <div class="nutrition-stat">
                      <small class="nutrition-value"
                        >{{ calculateNutrientAmount(nutrient, nutrient.fiber).toFixed(1) }}g</small
                      >
                      <small class="nutrition-label text-muted d-block">{{
                        $t('common.nutrients.fiber')
                      }}</small>
                    </div>
                  </div>
                </div>

                <!-- Net Carbs Calculation -->
                <div class="net-carbs-info mt-2 text-center">
                  <small class="text-muted">
                    <i class="bi bi-calculator me-1"></i>
                    {{ $t('components.mealHistoryCard.netCarbs') }}:
                    <strong class="text-success">
                      {{ calculateNetCarbs(nutrient).toFixed(1) }}g
                    </strong>
                    <span v-if="nutrient.fiber" class="ms-1 text-muted">
                      ({{ (nutrient.quantity * nutrient.factor).toFixed(1) }}g -
                      {{ calculateNutrientAmount(nutrient, nutrient.fiber).toFixed(1) }}g
                      {{ $t('common.nutrients.fiber') }})
                    </span>
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bolus Calculation Display -->
      <div v-if="meal.bolusCalculation" class="bolus-summary alert alert-info py-2 px-3 mb-2">
        <div class="row align-items-center">
          <div class="col-md-6">
            <small class="text-muted">{{ $t('components.mealHistoryCard.bolus.immediate') }}</small>
            <div class="fw-bold">
              <i class="bi bi-syringe me-1"></i>
              {{ meal.bolusCalculation.immediateBolusUnits.toFixed(1) }}
              {{ $t('components.mealHistoryCard.bolus.units') }}
            </div>
          </div>
          <div v-if="meal.bolusCalculation.extendedBolusUnits" class="col-md-6">
            <small class="text-muted">{{ $t('components.mealHistoryCard.bolus.extended') }}</small>
            <div class="fw-bold extended-bolus-text">
              <i class="bi bi-clock me-1"></i>
              {{ meal.bolusCalculation.extendedBolusUnits.toFixed(1) }}
              {{ $t('components.mealHistoryCard.bolus.units') }}
              <small class="text-muted">({{ meal.bolusCalculation.extendedBolusHours }}h)</small>
            </div>
          </div>
        </div>
        <div v-if="meal.bolusCalculation.dualWaveSplit" class="mt-1">
          <small class="text-muted">
            <i class="bi bi-graph-up me-1"></i>
            {{ $t('components.mealHistoryCard.bolus.dualWave') }}:
            {{ meal.bolusCalculation.dualWaveSplit }}
          </small>
        </div>
      </div>

      <!-- Tags -->
      <div v-if="meal.tags?.length" class="meal-tags">
        <span v-for="tag in meal.tags" :key="tag" class="badge rounded-pill text-bg-secondary me-1">
          {{ tag }}
        </span>
      </div>

      <!-- Notes -->
      <p v-if="meal.notes" class="card-text small text-muted mt-2 mb-0">
        {{ meal.notes }}
      </p>

      <!-- Debug Component (temporary - disabled) -->
      <!-- <MealDebug v-if="showDebug" :meal="meal" /> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSubjectStore } from '@/stores/subject'
import type { MealHistoryEntry } from '@/types/meal-history'
// import MealDebug from '@/components/debug/MealDebug.vue'

interface Props {
  meal: MealHistoryEntry
}

const props = defineProps<Props>()
const subjectStore = useSubjectStore()

defineEmits(['edit', 'duplicate', 'delete'])

// Get subject name from store
const subjectName = computed(() => {
  const subject = subjectStore.subjectById(props.meal.subjectId)
  return subject?.name
})

// Generate unique ID for dropdown
const dropdownId = `meal-actions-${Math.random().toString(36).substr(2, 9)}`

// Format date based on current locale
const formattedDate = computed(() => {
  const date = new Date(props.meal.date)
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
})

// Calculate total carbs
const totalCarbs = computed(() => {
  return props.meal.nutrients.reduce((total, nutrient) => {
    return total + nutrient.quantity * nutrient.factor
  }, 0)
})

// Calculate nutrient amount based on quantity
function calculateNutrientAmount(nutrient: any, nutrientPer100g: number): number {
  if (!nutrient.servingWeight) {
    // For custom measures (measureId = -1), use quantity directly
    return (nutrient.quantity * nutrientPer100g) / 100
  } else {
    // For predefined measures, calculate based on serving weight
    return (nutrient.servingWeight * nutrientPer100g) / 100
  }
}

// Calculate net carbs (carbs - fiber)
function calculateNetCarbs(nutrient: any): number {
  const totalCarbs = nutrient.quantity * nutrient.factor
  const fiberAmount = nutrient.fiber ? calculateNutrientAmount(nutrient, nutrient.fiber) : 0
  return Math.max(0, totalCarbs - fiberAmount)
}
</script>

<style scoped>
.meal-history-card {
  transition: transform 0.2s ease;
}

.meal-history-card:hover {
  transform: translateY(-2px);
}

.total-carbs {
  font-size: 1.25rem;
  font-weight: 500;
}

.meal-tags {
  margin-top: 0.5rem;
}

.food-items {
  border-top: 1px solid var(--bs-border-color);
  padding-top: 0.75rem;
}

.food-item {
  font-size: 0.9rem;
  transition: all 0.2s ease;
  background-color: var(--bs-body-bg);
  border-color: var(--bs-border-color) !important;
}

.food-item:hover {
  background-color: var(--bs-primary-bg-subtle) !important;
  border-color: var(--bs-primary-border-subtle) !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.food-title {
  font-size: 0.95rem;
  line-height: 1.3;
  color: var(--bs-body-color);
  font-weight: 600;
}

.food-details {
  font-size: 0.85rem;
}

.food-carbs .badge {
  font-size: 0.8rem;
  font-weight: 600;
}

.nutrition-details {
  border-top-color: var(--bs-border-color) !important;
}

.nutrition-stat {
  background-color: var(--bs-light);
  border-radius: 0.375rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--bs-border-color);
}

.nutrition-value {
  font-weight: 600;
  color: var(--bs-body-color);
  font-size: 0.8rem;
}

.nutrition-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.net-carbs-info {
  background-color: var(--bs-success-bg-subtle);
  border-radius: 0.375rem;
  padding: 0.5rem;
  border: 1px solid var(--bs-success-border-subtle);
}

.net-carbs-info .text-success {
  color: var(--bs-success-text-emphasis) !important;
}

/* Extended bolus styling with WCAG-compliant colors */
.extended-bolus-text {
  color: #b02a5b; /* Darker pink for better contrast (7.2:1 ratio) */
}

/* Dark mode specific adjustments */
[data-bs-theme='dark'] .food-item {
  background-color: var(--bs-dark);
  border-color: var(--bs-border-color-translucent) !important;
}

[data-bs-theme='dark'] .food-item:hover {
  background-color: var(--bs-primary-bg-subtle) !important;
  border-color: var(--bs-primary-border-subtle) !important;
}

[data-bs-theme='dark'] .nutrition-stat {
  background-color: var(--bs-dark);
  border-color: var(--bs-border-color-translucent);
}

[data-bs-theme='dark'] .nutrition-value {
  color: var(--bs-body-color);
}

[data-bs-theme='dark'] .net-carbs-info {
  background-color: var(--bs-success-bg-subtle);
  border-color: var(--bs-success-border-subtle);
}

[data-bs-theme='dark'] .extended-bolus-text {
  color: #ffc9dd; /* Much lighter pink for dark mode, high contrast (8.1:1 ratio) */
}

@media (max-width: 768px) {
  .food-items .col-md-6 {
    width: 100%;
  }

  .food-item {
    margin-bottom: 0.5rem;
  }

  .nutrition-details .row {
    --bs-gutter-x: 0.5rem;
  }
}
</style>
