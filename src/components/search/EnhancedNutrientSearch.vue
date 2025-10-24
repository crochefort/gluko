<template>
  <div class="enhanced-nutrient-search">
    <!-- Performance Mode Toggle -->
    <div class="mb-3 d-flex align-items-center justify-content-between">
      <div class="form-check form-switch">
        <input
          id="lazyLoadingSwitch"
          v-model="useLazyLoading"
          class="form-check-input"
          type="checkbox"
          role="switch"
          @change="onModeChange"
        />
        <label class="form-check-label" for="lazyLoadingSwitch">
          {{ $t('search.lazyLoading') }}
          <small class="text-muted d-block">
            {{
              useLazyLoading ? $t('search.lazyLoadingEnabled') : $t('search.lazyLoadingDisabled')
            }}
          </small>
        </label>
      </div>

      <!-- Memory Stats -->
      <div v-if="showStats" class="text-end">
        <small class="text-muted">
          <strong>{{ memoryStats.mode === 'lazy' ? '🚀' : '📦' }}</strong>
          {{ memoryStats.loadedFoods.toLocaleString() }}/{{
            memoryStats.totalFoods.toLocaleString()
          }}
          ({{ memoryStats.loadPercentage }})
        </small>
      </div>
    </div>

    <!-- Search Input -->
    <div class="position-relative">
      <div class="input-group">
        <span class="input-group-text">
          <i class="fas fa-search"></i>
        </span>
        <input
          v-model="searchQuery"
          type="text"
          class="form-control"
          :placeholder="$t('search.placeholder')"
          @input="onSearchInput"
          @keydown.enter.prevent="performSearch"
          @keydown.escape="clearSearch"
        />
        <button
          v-if="searchQuery"
          class="btn btn-outline-secondary"
          type="button"
          @click="clearSearch"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Loading indicator -->
      <div v-if="isSearching" class="position-absolute top-50 end-0 translate-middle-y me-5">
        <div class="spinner-border spinner-border-sm text-primary" role="status">
          <span class="visually-hidden">{{ $t('common.loading') }}</span>
        </div>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="searchResults.length > 0" class="search-results mt-3">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <small class="text-muted">
          {{ $t('search.resultsCount', { count: searchResults.length, total: totalResults }) }}
          <span v-if="searchTime">- {{ searchTime }}ms</span>
        </small>
        <button v-if="canLoadMore" class="btn btn-sm btn-outline-primary" @click="loadMoreResults">
          {{ $t('search.loadMore') }}
        </button>
      </div>

      <div class="results-list">
        <div
          v-for="food in searchResults"
          :key="food.foodId"
          class="result-item p-3 mb-2 border rounded"
          @click="selectFood(food)"
        >
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <h6 class="mb-1">
                {{ isLocaleEnglish ? food.foodDescription : food.foodDescriptionF }}
              </h6>
              <small class="text-muted">
                {{ $t('food.group') }}:
                {{ getGroupName(food.foodGroupId) }}
              </small>
              <div v-if="food.fctGluc" class="mt-1">
                <span class="badge bg-primary">
                  {{ $t('common.nutrients.carbs') }}: {{ food.fctGluc }}g/100g
                </span>
              </div>
            </div>
            <div class="text-end">
              <button class="btn btn-sm btn-outline-primary" @click.stop="selectFood(food)">
                {{ $t('common.select') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No results -->
    <div v-else-if="hasSearched && !isSearching" class="alert alert-info mt-3">
      <i class="fas fa-info-circle me-2"></i>
      {{ $t('search.noResults', { query: searchQuery }) }}
    </div>

    <!-- Debug Info (dev mode) -->
    <div v-if="showDebugInfo" class="mt-3 p-2 bg-light rounded">
      <small class="text-muted">
        <strong>Debug:</strong>
        Mode: {{ memoryStats.mode }} | Loaded Groups: {{ memoryStats.loadedGroups || 0 }} | Cache:
        {{ memoryStats.cacheSize || 0 }} | Last Search: {{ lastSearchMethod }}
      </small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNutrientFileStore, type NutrientFile } from '@/stores/nutrientsFile'

// Props & Emits
interface Props {
  modelValue?: NutrientFile | null
  maxResults?: number
  showStats?: boolean
  showDebugInfo?: boolean
  autoInitialize?: boolean
}

interface Emits {
  'update:modelValue': [value: NutrientFile | null]
  select: [food: NutrientFile]
  search: [query: string, results: NutrientFile[]]
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  maxResults: 50,
  showStats: true,
  showDebugInfo: false,
  autoInitialize: true
})

const emit = defineEmits<Emits>()

// Composables
const { locale } = useI18n()
const nutrientStore = useNutrientFileStore()

// State
const searchQuery = ref('')
const searchResults = ref<NutrientFile[]>([])
const isSearching = ref(false)
const hasSearched = ref(false)
const useLazyLoading = ref(false)
const searchTime = ref<number | null>(null)
const totalResults = ref(0)
const canLoadMore = ref(false)
const lastSearchMethod = ref<'legacy' | 'lazy'>('legacy')

let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Computed
const isLocaleEnglish = computed(() => locale.value === 'en')
const memoryStats = computed(() => nutrientStore.getMemoryStats())

// Food group names mapping (you might want to move this to i18n)
const FOOD_GROUP_NAMES = {
  1: { en: 'Dairy and Egg Products', fr: 'Produits laitiers et œufs' },
  2: { en: 'Spices and Herbs', fr: 'Épices et fines herbes' },
  3: { en: 'Baby Foods', fr: 'Aliments pour bébés' },
  4: { en: 'Fats and Oils', fr: 'Matières grasses et huiles' },
  5: { en: 'Poultry Products', fr: 'Produits de volaille' },
  6: { en: 'Soups, Sauces and Gravies', fr: 'Potages et sauces' },
  7: { en: 'Sausages and Luncheon Meats', fr: 'Saucisses et charcuteries' },
  8: { en: 'Breakfast Cereals', fr: 'Céréales à déjeuner' },
  9: { en: 'Fruits and Fruit Juices', fr: 'Fruits et jus de fruits' },
  10: { en: 'Pork Products', fr: 'Produits de porc' },
  11: { en: 'Vegetables and Vegetable Products', fr: 'Légumes et produits de légumes' },
  12: { en: 'Nut and Seed Products', fr: 'Noix et graines' },
  13: { en: 'Beef Products', fr: 'Produits de bœuf' },
  14: { en: 'Beverages', fr: 'Boissons' },
  15: { en: 'Finfish and Shellfish Products', fr: 'Poissons et fruits de mer' },
  16: { en: 'Legumes and Legume Products', fr: 'Légumineuses et produits de légumineuses' },
  17: { en: 'Lamb, Veal, and Game Products', fr: 'Agneau, veau et gibier' },
  18: { en: 'Baked Products', fr: 'Produits de boulangerie' },
  19: { en: 'Sweets', fr: 'Sucreries' },
  20: { en: 'Cereals, Grains and Pasta', fr: 'Céréales, grains et pâtes' },
  21: { en: 'Fast Foods', fr: 'Restauration rapide' },
  22: { en: 'Mixed Dishes', fr: 'Mets composés' }
}

// Methods
function getGroupName(groupId: number): string {
  const group = FOOD_GROUP_NAMES[groupId as keyof typeof FOOD_GROUP_NAMES]
  if (!group) return `Group ${groupId}`
  return isLocaleEnglish.value ? group.en : group.fr
}

async function onModeChange() {
  if (useLazyLoading.value) {
    const success = await nutrientStore.initializeLazyLoading()
    if (success) {
      console.log('✅ Switched to lazy loading mode')
      // Preload popular groups for better UX
      await nutrientStore.preloadPopularGroups()
    } else {
      console.log('⚠️ Lazy loading not available, staying in legacy mode')
      useLazyLoading.value = false
    }
  } else {
    console.log('📦 Switched to legacy loading mode')
  }

  // Re-run current search with new mode
  if (searchQuery.value) {
    await performSearch()
  }
}

function onSearchInput() {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(() => {
    performSearch()
  }, 300) // Debounce 300ms
}

async function performSearch() {
  if (!searchQuery.value || searchQuery.value.trim().length < 2) {
    clearResults()
    return
  }

  isSearching.value = true
  const startTime = performance.now()

  try {
    let results: NutrientFile[] = []

    if (useLazyLoading.value && nutrientStore.isLazyLoadingEnabled) {
      // Use lazy loading search
      results = await nutrientStore.searchFoodsLazy(
        searchQuery.value,
        isLocaleEnglish.value ? 'en' : 'fr',
        props.maxResults
      )
      lastSearchMethod.value = 'lazy'
    } else {
      // Use legacy search
      const legacyResults = nutrientStore.searchNutrients(searchQuery.value)
      results = legacyResults.slice(0, props.maxResults).map((r) => r.item)
      lastSearchMethod.value = 'legacy'
    }

    searchResults.value = results
    totalResults.value = results.length
    canLoadMore.value = results.length >= props.maxResults
    hasSearched.value = true

    const endTime = performance.now()
    searchTime.value = Math.round(endTime - startTime)

    emit('search', searchQuery.value, results)
  } catch (error) {
    console.error('Search failed:', error)
    searchResults.value = []
    totalResults.value = 0
  } finally {
    isSearching.value = false
  }
}

function loadMoreResults() {
  // TODO: Implement pagination for both modes
  console.log('Load more results - TODO: Implement pagination')
}

function selectFood(food: NutrientFile) {
  emit('update:modelValue', food)
  emit('select', food)
}

function clearSearch() {
  searchQuery.value = ''
  clearResults()
}

function clearResults() {
  searchResults.value = []
  totalResults.value = 0
  hasSearched.value = false
  canLoadMore.value = false
  searchTime.value = null
}

// Lifecycle
onMounted(async () => {
  if (props.autoInitialize) {
    // Try to initialize lazy loading on mount
    const lazySuccess = await nutrientStore.initializeLazyLoading()
    if (lazySuccess) {
      useLazyLoading.value = true
      console.log('🚀 Auto-initialized with lazy loading')
    } else {
      console.log('📦 Using legacy loading (chunks not available)')
    }
  }
})

// Watch for external model changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue && newValue.foodDescription) {
      searchQuery.value = isLocaleEnglish.value
        ? newValue.foodDescription
        : newValue.foodDescriptionF
    }
  }
)
</script>

<style scoped>
.enhanced-nutrient-search {
  width: 100%;
}

.result-item {
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-item:hover {
  background-color: var(--bs-light);
  border-color: var(--bs-primary) !important;
}

.results-list {
  max-height: 400px;
  overflow-y: auto;
}

.form-check-input:checked {
  background-color: var(--bs-success);
  border-color: var(--bs-success);
}

.badge {
  font-size: 0.75em;
}
</style>
