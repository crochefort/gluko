import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useIndexedDB } from '@/composables/useIndexedDB'
// Removed: import dataset from '@/assets/canadian_nutrient_file_diabetes.json'
import Fuse from 'fuse.js'

// Lazy Loading Types
export interface NutrientChunk {
  groupId: number
  groupName: string
  groupNameF: string
  count: number
  foods: NutrientFile[]
}

export interface SearchIndexEntry {
  foodId: number
  foodCode: number
  groupId: number
  name: string
  nameF: string
  fctGluc: number | null
}

export interface ChunkManifest {
  version: string
  created: string
  totalFoods: number
  totalGroups: number
  originalSize: string
  chunks: Array<{
    file: string
    groupId: number
    groupName: string
    count: number
    size: string
  }>
}

export interface NutrientInfo {
  value: number
  unit: string
  name: string
  nameF: string
}

export interface MeasureInfo {
  measureId: number
  measureName: string
  measureNameF: string
  conversionFactor?: number | null
  servingWeight?: number | null
  unit?: string
}

export interface NutrientFile {
  foodId: number
  foodCode: number
  foodGroupId: number
  foodGroupName: string
  foodGroupNameF: string
  foodDescription: string
  foodDescriptionF: string
  foodSourceId?: number
  scientificName?: string | null
  nutrients: Record<string, NutrientInfo>
  measures: MeasureInfo[]
  fctGluc: number | null
}

// Legacy interface for backward compatibility
export interface LegacyNutrientFile {
  FoodID: number
  FoodCode: number
  FoodGroupID: number
  FoodSourceID: number
  FoodDescription: string
  FoodDescriptionF: string
  '203': number
  '204': number
  '205': number
  '291': number | null
  FoodGroupName: string
  FoodGroupNameF: string
  FctGluc: number | null
}

export interface SearchResult {
  item: NutrientFile
  refIndex: number
  score?: number
  matches?: Array<{
    indices: Array<[number, number]>
    value: string
    key: string
  }>
}

export const useNutrientFileStore = defineStore('nutrientsFile', () => {
  const db = useIndexedDB()

  // Legacy state (current functionality)
  const nutrientsFile = ref<NutrientFile[]>([])
  const favoriteNutrients = ref<number[]>([])
  const searchCache = new Map<string, SearchResult[]>()

  // Lazy loading state
  const isLazyLoadingEnabled = ref(false)
  const isInitialized = ref(false)
  const loadedChunks = ref<Map<number, NutrientChunk>>(new Map())
  const searchIndex = ref<SearchIndexEntry[]>([])
  const manifest = ref<ChunkManifest | null>(null)
  const lazySearchCache = ref<Map<string, NutrientFile[]>>(new Map())
  const maxCacheSize = 50

  const loadInitialData = async () => {
    try {
      // Try to initialize lazy loading first
      const lazyLoadingSuccess = await initializeLazyLoading()
      
      if (lazyLoadingSuccess) {
        console.log('✅ Using lazy loading mode')
        isLazyLoadingEnabled.value = true
        
        // Preload popular groups for better UX
        await preloadPopularGroups()
      } else {
        console.warn('⚠️ Lazy loading chunks not available - falling back to empty state')
        // Instead of loading a large file, start with empty state
        nutrientsFile.value = []
      }

      // Load favorites from IndexedDB
      const storedFavorites = await db.get('favoriteNutrients', 'current')
      if (storedFavorites) {
        favoriteNutrients.value = storedFavorites
      }
    } catch (error) {
      console.error('Failed to load initial data:', error)
      // Fallback to empty state instead of loading large dataset
      nutrientsFile.value = []
    }
  }

  loadInitialData()

  const saveFavorites = async () => {
    try {
      await db.put('favoriteNutrients', favoriteNutrients.value, 'current')
    } catch (error) {
      console.error('Failed to save favorites:', error)
    }
  }

  const totalNutrients = computed(() => nutrientsFile.value.length)
  const favoriteCount = computed(() => favoriteNutrients.value.length)
  const isDataLoaded = computed(() => nutrientsFile.value.length > 0)
  const searchOptions = {
    keys: ['foodDescriptionF', 'foodDescription'],
    location: 0,
    distance: 200,
    threshold: 0.2,
    isCaseSensitive: false,
    includeMatches: true,
    includeScore: true,
    minMatchCharLength: 2
  }

  // Actions
  function searchNutrients(search: string): SearchResult[] {
    try {
      if (!search || search.trim().length < 2) {
        return []
      }

      const searchKey = search.toLowerCase().trim()

      // Check cache first
      if (searchCache.has(searchKey)) {
        return searchCache.get(searchKey)!
      }

      // If lazy loading is available, redirect to async lazy search
      if (isLazyLoadingEnabled.value) {
        console.log('🔄 Redirecting to lazy search for better performance')
        // Return empty for now - user should use searchFoodsLazy instead
        return []
      }

      if (nutrientsFile.value.length === 0) {
        console.warn('⚠️ No nutrient data available - initialize lazy loading first')
        return []
      }

      const fuse = new Fuse(nutrientsFile.value, searchOptions)
      const results = fuse.search(searchKey) as SearchResult[]

      // Cache results for performance
      if (results.length > 0) {
        searchCache.set(searchKey, results)
      }

      return results
    } catch (error) {
      console.error('Failed to search nutrients:', error)
      return []
    }
  }

  function getNutrientById(id: number): NutrientFile | undefined {
    try {
      return nutrientsFile.value.find((nutrient) => nutrient.foodId === id)
    } catch (error) {
      console.error('Failed to get nutrient by ID:', error)
      return undefined
    }
  }

  function addToFavorites(foodId: number): boolean {
    try {
      if (!favoriteNutrients.value.includes(foodId)) {
        favoriteNutrients.value.push(foodId)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to add to favorites:', error)
      return false
    }
  }

  function removeFromFavorites(foodId: number): boolean {
    try {
      const index = favoriteNutrients.value.indexOf(foodId)
      if (index !== -1) {
        favoriteNutrients.value.splice(index, 1)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to remove from favorites:', error)
      return false
    }
  }

  function toggleFavorite(foodId: number): boolean {
    try {
      if (favoriteNutrients.value.includes(foodId)) {
        return removeFromFavorites(foodId)
      } else {
        return addToFavorites(foodId)
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
      return false
    }
  }

  function isFavorite(foodId: number): boolean {
    try {
      return favoriteNutrients.value.includes(foodId)
    } catch (error) {
      console.error('Failed to check favorite status:', error)
      return false
    }
  }

  function getFavoriteNutrients(): NutrientFile[] {
    try {
      return favoriteNutrients.value
        .map((id) => getNutrientById(id))
        .filter((nutrient): nutrient is NutrientFile => nutrient !== undefined)
    } catch (error) {
      console.error('Failed to get favorite nutrients:', error)
      return []
    }
  }

  function clearSearchCache(): void {
    try {
      searchCache.clear()
    } catch (error) {
      console.error('Failed to clear search cache:', error)
    }
  }

  async function reloadData(): Promise<boolean> {
    try {
      // Try to reinitialize lazy loading
      const success = await initializeLazyLoading()
      if (success) {
        await preloadPopularGroups()
        console.log('✅ Data reloaded using lazy loading')
      } else {
        console.warn('⚠️ Lazy loading unavailable, clearing data')
        nutrientsFile.value = []
      }
      clearSearchCache()
      return true
    } catch (error) {
      console.error('Failed to reload data:', error)
      return false
    }
  }

  async function initializeData(): Promise<boolean> {
    try {
      if (!isLazyLoadingEnabled.value) {
        const success = await initializeLazyLoading()
        if (success) {
          await preloadPopularGroups()
          return true
        }
      }
      return isLazyLoadingEnabled.value
    } catch (error) {
      console.error('Failed to initialize nutrient data:', error)
      return false
    }
  }

  async function $reset(): Promise<boolean> {
    try {
      // Clear legacy data
      nutrientsFile.value = []
      favoriteNutrients.value = []
      
      // Clear lazy loading data
      loadedChunks.value.clear()
      lazySearchCache.value.clear()
      
      // Clear storage
      await db.put('nutrientsFile', [], 0)
      await saveFavorites()
      clearSearchCache()
      
      // Reinitialize
      await loadInitialData()
      
      return true
    } catch (error) {
      console.error('Failed to reset nutrient file store:', error)
      return false
    }
  }

  // ===== LAZY LOADING FUNCTIONS =====

  /**
   * Initialize lazy loading by loading the search index and manifest
   */
  async function initializeLazyLoading(): Promise<boolean> {
    if (isInitialized.value) return true

    try {
      console.log('🚀 Initializing lazy-loaded nutrients store...')

      // Check if chunks exist by trying to load manifest
      const manifestResponse = await fetch('/src/assets/nutrient-chunks/manifest.json')
      if (!manifestResponse.ok) {
        console.log('⚠️ Chunk files not found, staying with legacy loading')
        return false
      }

      // Load search index
      const searchResponse = await fetch('/src/assets/nutrient-chunks/search-index.json')
      if (!searchResponse.ok) {
        throw new Error(`Failed to load search index: ${searchResponse.statusText}`)
      }
      const searchData = await searchResponse.json()
      searchIndex.value = searchData.searchIndex

      // Load manifest
      manifest.value = await manifestResponse.json()

      isLazyLoadingEnabled.value = true
      isInitialized.value = true

      console.log(
        `✅ Lazy loading initialized with ${searchIndex.value.length} foods across ${manifest.value?.chunks.length || 0} groups`
      )
      return true
    } catch (err) {
      console.error('❌ Failed to initialize lazy loading:', err)
      isLazyLoadingEnabled.value = false
      return false
    }
  }

  /**
   * Load a specific food group chunk
   */
  async function loadFoodGroup(groupId: number): Promise<NutrientChunk | null> {
    if (!isLazyLoadingEnabled.value) return null
    if (loadedChunks.value.has(groupId)) {
      return loadedChunks.value.get(groupId)!
    }

    try {
      const response = await fetch(`/src/assets/nutrient-chunks/group-${groupId}.json`)

      if (!response.ok) {
        throw new Error(`Failed to load group ${groupId}: ${response.statusText}`)
      }

      const chunk: NutrientChunk = await response.json()
      loadedChunks.value.set(groupId, chunk)

      console.log(`✅ Loaded group ${groupId}: ${chunk.count} foods (${chunk.groupName})`)
      return chunk
    } catch (err) {
      console.error(`❌ Failed to load group ${groupId}:`, err)
      return null
    }
  }

  /**
   * Search foods with lazy loading support
   */
  async function searchFoodsLazy(
    query: string,
    language: 'en' | 'fr' = 'en',
    maxResults: number = 100
  ): Promise<NutrientFile[]> {
    if (!isLazyLoadingEnabled.value) {
      // Fallback to regular search
      const results = searchNutrients(query)
      return results.slice(0, maxResults).map((r) => r.item)
    }

    // Check cache first
    const cacheKey = `${query}-${language}-${maxResults}`
    if (lazySearchCache.value.has(cacheKey)) {
      return lazySearchCache.value.get(cacheKey)!
    }

    const normalizedQuery = query.toLowerCase().trim()
    if (normalizedQuery.length < 2) return []

    try {
      // Search in the index
      const fieldName = language === 'fr' ? 'nameF' : 'name'
      const matchingIndexEntries = searchIndex.value
        .filter((entry) => entry[fieldName].toLowerCase().includes(normalizedQuery))
        .slice(0, maxResults)

      if (matchingIndexEntries.length === 0) return []

      // Group matches by food group to minimize chunk loads
      const groupsNeeded = new Set(matchingIndexEntries.map((entry) => entry.groupId))

      // Load required chunks
      const loadPromises = Array.from(groupsNeeded).map((groupId) => loadFoodGroup(groupId))
      await Promise.all(loadPromises)

      // Find full food objects
      const results: NutrientFile[] = []
      for (const indexEntry of matchingIndexEntries) {
        const chunk = loadedChunks.value.get(indexEntry.groupId)
        if (chunk) {
          const food = chunk.foods.find((f) => f.foodId === indexEntry.foodId)
          if (food) {
            results.push(food)
          }
        }
      }

      // Cache results (with size limit)
      if (lazySearchCache.value.size >= maxCacheSize) {
        const firstKey = lazySearchCache.value.keys().next().value
        if (firstKey) {
          lazySearchCache.value.delete(firstKey)
        }
      }
      lazySearchCache.value.set(cacheKey, results)

      return results
    } catch (err) {
      console.error('❌ Lazy search failed:', err)
      return []
    }
  }

  /**
   * Get a specific food by ID with lazy loading
   */
  async function getFoodByIdLazy(foodId: number): Promise<NutrientFile | null> {
    if (!isLazyLoadingEnabled.value) {
      return getNutrientById(foodId) || null
    }

    // Find in search index first
    const indexEntry = searchIndex.value.find((entry) => entry.foodId === foodId)
    if (!indexEntry) {
      return null
    }

    // Load the required group
    const chunk = await loadFoodGroup(indexEntry.groupId)
    if (!chunk) return null

    // Find the full food object
    return chunk.foods.find((food) => food.foodId === foodId) || null
  }

  /**
   * Preload popular food groups for better UX
   */
  async function preloadPopularGroups(): Promise<void> {
    if (!isLazyLoadingEnabled.value) return

    const popularGroups = [9, 11, 18, 20, 21] // Fruits, Vegetables, Baked, Cereals, Fast Foods
    console.log('🚀 Preloading popular food groups...')
    const loadPromises = popularGroups.map((groupId) => loadFoodGroup(groupId))
    await Promise.all(loadPromises)
    console.log('✅ Popular groups preloaded')
  }

  /**
   * Get memory usage statistics
   */
  function getMemoryStats() {
    if (!isLazyLoadingEnabled.value) {
      return {
        mode: 'legacy',
        totalFoods: nutrientsFile.value.length,
        loadedFoods: nutrientsFile.value.length,
        loadPercentage: '100%'
      }
    }

    const loadedFoodsCount = Array.from(loadedChunks.value.values()).reduce(
      (sum, chunk) => sum + chunk.count,
      0
    )

    return {
      mode: 'lazy',
      totalFoods: manifest.value?.totalFoods || 0,
      loadedFoods: loadedFoodsCount,
      loadedGroups: loadedChunks.value.size,
      totalGroups: manifest.value?.chunks.length || 0,
      cacheSize: lazySearchCache.value.size,
      loadPercentage:
        manifest.value?.totalFoods && manifest.value.totalFoods > 0
          ? ((loadedFoodsCount / manifest.value.totalFoods) * 100).toFixed(1) + '%'
          : '0%'
    }
  }

  return {
    // State
    nutrientsFile,
    favoriteNutrients,
    // Getters
    totalNutrients,
    favoriteCount,
    isDataLoaded,
    // Legacy Actions
    searchNutrients,
    getNutrientById,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorite,
    getFavoriteNutrients,
    clearSearchCache,
    initializeData,
    reloadData,
    $reset,
    // Lazy Loading State
    isLazyLoadingEnabled,
    isInitialized,
    // Lazy Loading Actions
    initializeLazyLoading,
    searchFoodsLazy,
    getFoodByIdLazy,
    preloadPopularGroups,
    getMemoryStats
  }
})
