<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNutrientFileStore, type SearchResult } from '@/stores/nutrientsFile'

const store = useNutrientFileStore()

const search = ref('')
const searchInput = ref('')
const loading = ref(false)
const searchResults = ref<SearchResult[]>([])

// Initialize lazy loading on component mount
store.initializeLazyLoading()

// Perform search using lazy loading
async function performSearch(query: string) {
  if (!query || query.trim().length < 2) {
    searchResults.value = []
    return
  }
  
  loading.value = true
  try {
    if (store.isLazyLoadingEnabled) {
      // Use lazy loading search
      const results = await store.searchFoodsLazy(query, 'en', 100)
      // Convert to legacy format for compatibility
      searchResults.value = results.map((item, index) => ({ 
        item, 
        refIndex: index,
        score: 1
      }))
    } else {
      // Fallback to legacy search
      searchResults.value = store.searchNutrients(query)
    }
  } catch (error) {
    console.error('Search failed:', error)
    searchResults.value = []
  } finally {
    loading.value = false
  }
}

const cnfLink = computed(() => (foodCode: number, locale: string) => {
  return `https://food-nutrition.canada.ca/cnf-fce/serving-portion?id=${foodCode}&lang=${
    locale === 'fr' ? 'fre' : 'eng'
  }`
})

// Trigger search from button click or enter key
const triggerSearch = async () => {
  const query = searchInput.value.trim()
  search.value = query
  await performSearch(query)
}

// Handle enter key in input
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    triggerSearch()
  }
}
</script>
<template>
  <div class="container">
    <h2>{{ $t('components.search.title') }}</h2>
    <div class="row">
      <div class="col">
        <div class="input-group mb-3">
          <button
            id="button-search-nutrient"
            class="btn btn-secondary"
            type="button"
            aria-label="Search"
            @click="triggerSearch"
          >
            <i class="bi bi-search" /> {{ $t('common.actions.search') }}
          </button>
          <input
            id="searchInput"
            v-model="searchInput"
            type="text"
            class="form-control"
            :placeholder="$t('components.search.placeholder')"
            @keydown="handleKeydown"
          />
        </div>
      </div>
      <div>
        <h2>
          {{ $t('components.search.results', { count: searchResults.length }) }}
        </h2>
        <div v-if="loading" class="d-flex justify-content-center">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <ul v-else-if="searchResults !== undefined && searchResults.length > 0" class="list-group">
          <li class="list-group-item">
            <div class="row">
              <div class="col-8 display-6">{{ $t('common.labels.nutrient') }}</div>
              <div class="col-4 display-6 text-center">{{ $t('common.labels.factor') }}</div>
            </div>
          </li>
          <li v-for="result in searchResults" :key="result.refIndex" class="list-group-item">
            <div class="row">
              <div class="col-8">
                <p>
                  <span v-if="$i18n.locale === 'fr'">{{ result.item.foodDescriptionF }}</span>
                  <span v-else>{{ result.item.foodDescription }}</span>
                  <a
                    :href="cnfLink(result.item.foodCode, $i18n.locale)"
                    target="_blank"
                    class="link-primary small"
                  >
                    {{ $t('components.search.source') }} <i class="bi bi-box-arrow-up-right" />
                  </a>
                </p>
              </div>
              <div class="col-4">
                <p class="text-center">
                  {{
                    result.item.fctGluc !== null
                      ? result.item.fctGluc.toFixed(2)
                      : (result.item.nutrients['205']?.value / 100).toFixed(2)
                  }}
                </p>
              </div>
            </div>
          </li>
        </ul>
        <ul v-else class="list-group">
          <li class="list-group-item">{{ $t('common.labels.noResults') }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>
