<template>
  <div class="meal-debug p-3 border rounded bg-light">
    <h6>🐛 Debug: Meal Data</h6>
    <details>
      <summary class="mb-2">Meal Details ({{ meal.id }})</summary>
      <pre class="small">{{ JSON.stringify(meal, null, 2) }}</pre>
    </details>

    <div class="mt-2">
      <strong>Nutrients:</strong>
      <ul class="list-unstyled mt-1">
        <li v-for="(nutrient, index) in meal.nutrients" :key="index" class="mb-1">
          <span class="badge bg-secondary me-2">{{ index + 1 }}</span>
          <strong>{{ nutrient.name || '❌ NO NAME' }}</strong>
          <small class="text-muted ms-2">
            ({{ nutrient.quantity }}{{ nutrient.unit || 'g' }} =
            {{ (nutrient.quantity * nutrient.factor).toFixed(1) }}g carbs)
          </small>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MealHistoryEntry } from '@/types/meal-history'

defineProps<{
  meal: MealHistoryEntry
}>()
</script>

<style scoped>
pre {
  max-height: 200px;
  overflow-y: auto;
  font-size: 0.75rem;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  padding: 0.5rem;
}

.meal-debug {
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
</style>
