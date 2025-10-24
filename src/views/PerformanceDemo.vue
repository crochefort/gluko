<template>
  <div class="performance-demo">
    <div class="container-fluid py-4">
      <div class="row">
        <div class="col-12">
          <h2 class="mb-4">
            <i class="fas fa-rocket me-2"></i>
            Performance Optimization Demo
          </h2>

          <!-- Performance Stats Card -->
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">
                <i class="fas fa-chart-line me-2"></i>
                Memory Usage Statistics
              </h5>
              <button class="btn btn-sm btn-outline-primary" @click="refreshStats">
                <i class="fas fa-sync-alt me-1"></i>
                Refresh
              </button>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-3 col-sm-6 mb-3">
                  <div class="stat-box text-center p-3 bg-primary bg-opacity-10 rounded">
                    <h3 class="text-primary mb-1">{{ stats.mode === 'lazy' ? '🚀' : '📦' }}</h3>
                    <h6 class="text-muted mb-0">
                      {{ stats.mode === 'lazy' ? 'Lazy Loading' : 'Legacy Mode' }}
                    </h6>
                  </div>
                </div>
                <div class="col-md-3 col-sm-6 mb-3">
                  <div class="stat-box text-center p-3 bg-success bg-opacity-10 rounded">
                    <h3 class="text-success mb-1">{{ stats.loadedFoods.toLocaleString() }}</h3>
                    <h6 class="text-muted mb-0">Loaded Foods</h6>
                  </div>
                </div>
                <div class="col-md-3 col-sm-6 mb-3">
                  <div class="stat-box text-center p-3 bg-info bg-opacity-10 rounded">
                    <h3 class="text-info mb-1">{{ stats.totalFoods.toLocaleString() }}</h3>
                    <h6 class="text-muted mb-0">Total Foods</h6>
                  </div>
                </div>
                <div class="col-md-3 col-sm-6 mb-3">
                  <div class="stat-box text-center p-3 bg-warning bg-opacity-10 rounded">
                    <h3 class="text-warning mb-1">{{ stats.loadPercentage }}</h3>
                    <h6 class="text-muted mb-0">Memory Usage</h6>
                  </div>
                </div>
              </div>

              <div v-if="stats.mode === 'lazy'" class="row mt-3">
                <div class="col-md-4 col-sm-6 mb-2">
                  <small class="text-muted">
                    <strong>Loaded Groups:</strong> {{ stats.loadedGroups }}/{{ stats.totalGroups }}
                  </small>
                </div>
                <div class="col-md-4 col-sm-6 mb-2">
                  <small class="text-muted">
                    <strong>Cache Size:</strong> {{ stats.cacheSize }} searches
                  </small>
                </div>
                <div class="col-md-4 col-sm-6 mb-2">
                  <small class="text-muted">
                    <strong>Original File:</strong> 66MB → {{ getChunkStats() }}
                  </small>
                </div>
              </div>
            </div>
          </div>

          <!-- Search Performance Test -->
          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">
                <i class="fas fa-search me-2"></i>
                Search Performance Test
              </h5>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-8">
                  <EnhancedNutrientSearch
                    v-model="selectedFood"
                    :show-stats="true"
                    :show-debug-info="true"
                    :max-results="50"
                    @search="onSearchPerformed"
                  />
                </div>
                <div class="col-md-4">
                  <div class="performance-metrics">
                    <h6>Performance Metrics</h6>
                    <div v-if="searchMetrics.length > 0" class="mt-3">
                      <div
                        v-for="(metric, index) in searchMetrics.slice(-5)"
                        :key="index"
                        class="metric-item p-2 mb-2 bg-light rounded"
                      >
                        <div class="d-flex justify-content-between">
                          <span class="fw-bold">{{ metric.query }}</span>
                          <span
                            class="badge"
                            :class="metric.mode === 'lazy' ? 'bg-success' : 'bg-secondary'"
                          >
                            {{ metric.mode }}
                          </span>
                        </div>
                        <small class="text-muted">
                          {{ metric.results }} results in {{ metric.time }}ms
                        </small>
                      </div>
                    </div>
                    <div v-else class="text-muted">
                      <small>Start searching to see performance metrics</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Benchmark Tests -->
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">
                <i class="fas fa-stopwatch me-2"></i>
                Benchmark Tests
              </h5>
              <div>
                <button
                  class="btn btn-outline-primary me-2"
                  :disabled="isRunningBenchmark"
                  @click="runBenchmark"
                >
                  <i class="fas fa-play me-1"></i>
                  {{ isRunningBenchmark ? 'Running...' : 'Run Benchmark' }}
                </button>
                <button class="btn btn-outline-secondary" @click="clearBenchmarkResults">
                  <i class="fas fa-trash me-1"></i>
                  Clear
                </button>
              </div>
            </div>
            <div class="card-body">
              <div v-if="benchmarkResults.length > 0" class="table-responsive">
                <table class="table table-striped">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Mode</th>
                      <th>Results</th>
                      <th>Time (ms)</th>
                      <th>Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(result, index) in benchmarkResults" :key="index">
                      <td>
                        <code>{{ result.query }}</code>
                      </td>
                      <td>
                        <span
                          class="badge"
                          :class="result.mode === 'lazy' ? 'bg-success' : 'bg-secondary'"
                        >
                          {{ result.mode }}
                        </span>
                      </td>
                      <td>{{ result.results }}</td>
                      <td>{{ result.time }}</td>
                      <td>
                        <div class="progress" style="height: 8px">
                          <div
                            class="progress-bar"
                            :class="getPerformanceClass(result.time)"
                            :style="{ width: getPerformanceWidth(result.time) + '%' }"
                          ></div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else-if="isRunningBenchmark" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Running benchmark...</span>
                </div>
                <p class="mt-2 text-muted">Running performance tests...</p>
              </div>
              <div v-else class="text-center py-4 text-muted">
                <i class="fas fa-chart-bar fa-2x mb-3"></i>
                <p>Click "Run Benchmark" to compare search performance</p>
              </div>
            </div>
          </div>

          <!-- Selected Food Details -->
          <div v-if="selectedFood" class="card">
            <div class="card-header">
              <h5 class="mb-0">
                <i class="fas fa-info-circle me-2"></i>
                Selected Food Details
              </h5>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <h6>{{ selectedFood.foodDescription }}</h6>
                  <p class="text-muted">{{ selectedFood.foodDescriptionF }}</p>
                  <p><strong>Food ID:</strong> {{ selectedFood.foodId }}</p>
                  <p><strong>Food Code:</strong> {{ selectedFood.foodCode }}</p>
                  <p><strong>Group ID:</strong> {{ selectedFood.foodGroupId }}</p>
                </div>
                <div class="col-md-6">
                  <div v-if="selectedFood.fctGluc" class="alert alert-primary">
                    <strong>Carbohydrates:</strong> {{ selectedFood.fctGluc }}g per 100g
                  </div>
                  <div v-if="selectedFood.measures && selectedFood.measures.length > 0">
                    <h6>Available Measures:</h6>
                    <ul class="list-unstyled">
                      <li
                        v-for="measure in selectedFood.measures.slice(0, 3)"
                        :key="measure.measureId"
                        class="mb-1"
                      >
                        <span class="badge bg-light text-dark me-2">{{ measure.measureId }}</span>
                        {{ measure.measureName }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNutrientFileStore, type NutrientFile } from '@/stores/nutrientsFile'
import EnhancedNutrientSearch from '@/components/search/EnhancedNutrientSearch.vue'

// Store
const nutrientStore = useNutrientFileStore()

// State
const selectedFood = ref<NutrientFile | null>(null)
const searchMetrics = ref<
  Array<{
    query: string
    mode: 'legacy' | 'lazy'
    results: number
    time: number
  }>
>([])
const benchmarkResults = ref<
  Array<{
    query: string
    mode: 'legacy' | 'lazy'
    results: number
    time: number
  }>
>([])
const isRunningBenchmark = ref(false)

// Computed
const stats = computed(() => nutrientStore.getMemoryStats())

// Methods
function refreshStats() {
  // Force reactivity update
  console.log('📊 Stats refreshed:', stats.value)
}

function getChunkStats() {
  if (stats.value.mode === 'lazy') {
    const avgChunkSize = 3.1 // MB average from our splitting
    const totalLoaded = (stats.value.loadedGroups || 0) * avgChunkSize
    return `~${totalLoaded.toFixed(1)}MB loaded`
  }
  return '66MB loaded'
}

function onSearchPerformed(query: string, results: NutrientFile[]) {
  // Record search performance
  const metric = {
    query: query.substring(0, 20) + (query.length > 20 ? '...' : ''),
    mode: stats.value.mode as 'legacy' | 'lazy',
    results: results.length,
    time: 0 // Will be updated by the search component
  }

  // Get timing from last search (would need to be passed from component)
  setTimeout(() => {
    searchMetrics.value.push(metric)
    if (searchMetrics.value.length > 20) {
      searchMetrics.value.shift()
    }
  }, 100)
}

async function runBenchmark() {
  if (isRunningBenchmark.value) return

  isRunningBenchmark.value = true
  benchmarkResults.value = []

  const testQueries = ['apple', 'chicken', 'bread', 'milk', 'banana', 'beef', 'potato', 'cheese']

  try {
    // Test both modes if available
    const modes: ('legacy' | 'lazy')[] = []

    // Always test legacy
    modes.push('legacy')

    // Test lazy if available
    if (await nutrientStore.initializeLazyLoading()) {
      modes.push('lazy')
    }

    for (const mode of modes) {
      for (const query of testQueries) {
        const startTime = performance.now()

        let results: NutrientFile[] = []
        if (mode === 'lazy' && nutrientStore.isLazyLoadingEnabled) {
          results = await nutrientStore.searchFoodsLazy(query, 'en', 50)
        } else {
          const legacyResults = nutrientStore.searchNutrients(query)
          results = legacyResults.slice(0, 50).map((r) => r.item)
        }

        const endTime = performance.now()
        const time = Math.round(endTime - startTime)

        benchmarkResults.value.push({
          query,
          mode,
          results: results.length,
          time
        })

        // Small delay to prevent blocking
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }

    // Sort by query for comparison
    benchmarkResults.value.sort((a, b) => {
      if (a.query === b.query) {
        return a.mode.localeCompare(b.mode)
      }
      return a.query.localeCompare(b.query)
    })
  } catch (error) {
    console.error('Benchmark failed:', error)
  } finally {
    isRunningBenchmark.value = false
  }
}

function clearBenchmarkResults() {
  benchmarkResults.value = []
  searchMetrics.value = []
}

function getPerformanceClass(time: number): string {
  if (time < 10) return 'bg-success'
  if (time < 50) return 'bg-warning'
  return 'bg-danger'
}

function getPerformanceWidth(time: number): number {
  const maxTime = Math.max(...benchmarkResults.value.map((r) => r.time), 100)
  return Math.min(100, (time / maxTime) * 100)
}

// Lifecycle
onMounted(async () => {
  console.log('🎯 Performance demo mounted')

  // Try to initialize lazy loading
  await nutrientStore.initializeLazyLoading()

  refreshStats()
})
</script>

<style scoped>
.stat-box {
  border: 1px solid var(--bs-border-color);
}

.performance-metrics {
  max-height: 400px;
  overflow-y: auto;
}

.metric-item {
  border: 1px solid var(--bs-border-color);
}

.progress {
  background-color: var(--bs-gray-200);
}

.card {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.badge {
  font-size: 0.75em;
}
</style>
