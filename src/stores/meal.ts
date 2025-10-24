import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { useSubjectStore } from './subject'
import type { CalculationSession } from '@/types/meal-history'

export interface Nutrient {
  id: string
  name: string
  quantity: number
  factor: number
  measureId?: number
  measureName?: string
  measureNameF?: string
  unit?: string
  fiber?: number // Fiber content per 100g (nutrient code 291)
  protein?: number // Protein content per 100g (nutrient code 203)
  fat?: number // Fat content per 100g (nutrient code 204)
  servingWeight?: number // Actual weight of the selected measure in grams
}

export const useMealStore = defineStore('mealStore', () => {
  const db = useIndexedDB()
  const subjectStore = useSubjectStore()
  const getUUID = () => crypto.randomUUID()

  // State
  const activeSessions = ref<Map<string, CalculationSession>>(new Map())
  const error = ref<Error | null>(null)

  // Load initial data
  const loadInitialData = async () => {
    try {
      // Wait for subject store to be ready
      await subjectStore.loadInitialData()

      if (!subjectStore.activeSubjects.length) {
        console.warn('No active subjects found, skipping session load')
        return
      }

      // Load all active sessions
      console.log('Loading draft sessions...')
      const sessions = await db.getAllByIndex('activeSessions', 'by-status', 'draft')
      console.log('Found sessions:', sessions)
      sessions.forEach((session) => {
        activeSessions.value.set(session.subjectId, session)
        console.log('Added session for subject:', session.subjectId)
      })

      // Create session for active subject if none exists
      const currentSubject = subjectStore.currentSubject
      if (currentSubject && !activeSessions.value.has(currentSubject.id)) {
        console.log('Creating new session for active subject:', currentSubject.id)
        await loadOrCreateSession(currentSubject.id)
      }
    } catch (err) {
      console.error('Failed to load initial data:', err)
      error.value = err instanceof Error ? err : new Error(String(err))
    }
  }

  // Initialize store
  loadInitialData()

  // Watch for subject changes
  watch(
    () => subjectStore.activeSubjectId,
    async (newId, oldId) => {
      if (oldId) {
        // Save current session for previous subject
        await saveSession(oldId)
      }
      if (newId) {
        // Load or create session for new subject
        await loadOrCreateSession(newId)
      }
    }
  )

  // Helper functions
  const getCurrentSession = () => {
    if (!subjectStore.currentSubject) return null
    return activeSessions.value.get(subjectStore.currentSubject.id) || null
  }

  // Calculate fiber content for a nutrient
  const calculateFiberContent = (nutrient: Nutrient): number => {
    if (!nutrient.fiber || nutrient.fiber === null) {
      return 0
    }

    // For custom measures (measureId = -1), use quantity directly as grams
    if (nutrient.measureId === -1) {
      return (nutrient.fiber / 100) * nutrient.quantity
    }

    // For predefined measures, use servingWeight * quantity
    if (!nutrient.servingWeight || nutrient.servingWeight === null) {
      return 0
    }

    return (nutrient.fiber / 100) * nutrient.servingWeight * nutrient.quantity
  }

  // Calculate net carbs for a nutrient (total carbs - fiber)
  const calculateNetCarbs = (nutrient: Nutrient): number => {
    const totalCarbs = nutrient.quantity * nutrient.factor
    const fiberContent = calculateFiberContent(nutrient)
    return Math.max(0, totalCarbs - fiberContent) // Ensure we don't get negative net carbs
  }

  // Getters
  const currentNutrients = computed(() => {
    const session = getCurrentSession()
    return session?.nutrients || []
  })

  const nutrientEmpty = computed(() => currentNutrients.value.length <= 0)

  const mealCarbs = computed(() =>
    currentNutrients.value.reduce(
      (totalNetCarbs: number, nutrient: Nutrient) => totalNetCarbs + calculateNetCarbs(nutrient),
      0
    )
  )

  const nutrientCount = computed(() => currentNutrients.value.length)

  // Actions
  async function loadOrCreateSession(subjectId: string): Promise<boolean> {
    try {
      // Check if we already have the session loaded
      if (activeSessions.value.has(subjectId)) return true

      // Try to load existing draft session
      const existingSessions = await db.getSessionsBySubject(subjectId)
      const draftSession = existingSessions.find((s) => s.status === 'draft')

      if (draftSession) {
        activeSessions.value.set(subjectId, draftSession)
        return true
      }

      // Create new session if none exists
      const newSession: CalculationSession = {
        id: getUUID(),
        subjectId,
        nutrients: [],
        created: new Date(),
        lastModified: new Date(),
        status: 'draft'
      }

      await db.saveSession(newSession)
      activeSessions.value.set(subjectId, newSession)
      return true
    } catch (err) {
      console.error('Failed to load or create session:', err)
      error.value = err instanceof Error ? err : new Error(String(err))
      return false
    }
  }

  async function saveSession(subjectId: string): Promise<boolean> {
    try {
      const session = activeSessions.value.get(subjectId)
      if (!session) return false

      const updatedSession = {
        ...session,
        lastModified: new Date()
      }

      await db.saveSession(updatedSession)
      activeSessions.value.set(subjectId, updatedSession)
      return true
    } catch (err) {
      console.error('Failed to save session:', err)
      error.value = err instanceof Error ? err : new Error(String(err))
      return false
    }
  }

  async function addNutrient(nutrient: Nutrient): Promise<boolean> {
    try {
      const session = getCurrentSession()
      if (!session) return false

      const updatedSession = {
        ...session,
        nutrients: [...session.nutrients, nutrient],
        lastModified: new Date()
      }

      await db.saveSession(updatedSession)
      activeSessions.value.set(session.subjectId, updatedSession)
      return true
    } catch (err) {
      console.error('Failed to add nutrient:', err)
      error.value = err instanceof Error ? err : new Error(String(err))
      return false
    }
  }

  async function addEmptyNutrient(): Promise<boolean> {
    const uuid = getUUID()
    return addNutrient({
      id: uuid,
      name: 'Aliment',
      quantity: 0,
      factor: 0,
      fiber: 0,
      protein: 0,
      fat: 0,
      servingWeight: 0
    })
  }

  async function removeNutrient(identifier: string | number | Nutrient): Promise<boolean> {
    try {
      const session = getCurrentSession()
      if (!session) return false

      let index = -1
      if (typeof identifier === 'string') {
        index = session.nutrients.findIndex((n) => n.id === identifier)
      } else if (typeof identifier === 'number') {
        index = identifier
      } else {
        index = session.nutrients.findIndex((n) => n.id === identifier.id)
      }

      if (index === -1 || index >= session.nutrients.length) return false

      const updatedNutrients = [...session.nutrients]
      updatedNutrients.splice(index, 1)

      const updatedSession = {
        ...session,
        nutrients: updatedNutrients,
        lastModified: new Date()
      }

      await db.saveSession(updatedSession)
      activeSessions.value.set(session.subjectId, updatedSession)
      return true
    } catch (err) {
      console.error('Failed to remove nutrient:', err)
      error.value = err instanceof Error ? err : new Error(String(err))
      return false
    }
  }

  async function updateNutrient(nutrient: Nutrient): Promise<boolean> {
    try {
      const session = getCurrentSession()
      if (!session) return false

      const index = session.nutrients.findIndex((n) => n.id === nutrient.id)
      if (index === -1) return false

      const updatedNutrients = [...session.nutrients]
      updatedNutrients[index] = nutrient

      const updatedSession = {
        ...session,
        nutrients: updatedNutrients,
        lastModified: new Date()
      }

      await db.saveSession(updatedSession)
      activeSessions.value.set(session.subjectId, updatedSession)
      return true
    } catch (err) {
      console.error('Failed to update nutrient:', err)
      error.value = err instanceof Error ? err : new Error(String(err))
      return false
    }
  }

  async function clearSession(): Promise<boolean> {
    try {
      const session = getCurrentSession()
      if (!session) return false

      const updatedSession = {
        ...session,
        nutrients: [],
        lastModified: new Date()
      }

      await db.saveSession(updatedSession)
      activeSessions.value.set(session.subjectId, updatedSession)
      return true
    } catch (err) {
      console.error('Failed to clear session:', err)
      error.value = err instanceof Error ? err : new Error(String(err))
      return false
    }
  }

  async function duplicateSessionTo(targetSubjectId: string): Promise<boolean> {
    try {
      const sourceSession = getCurrentSession()
      if (!sourceSession) return false

      // Create new session for target subject
      const newSession: CalculationSession = {
        id: getUUID(),
        subjectId: targetSubjectId,
        nutrients: sourceSession.nutrients.map((n) => ({
          ...n,
          id: getUUID() // Generate new IDs for duplicated nutrients
        })),
        created: new Date(),
        lastModified: new Date(),
        status: 'draft'
      }

      await db.saveSession(newSession)
      activeSessions.value.set(targetSubjectId, newSession)
      return true
    } catch (err) {
      console.error('Failed to duplicate session:', err)
      error.value = err instanceof Error ? err : new Error(String(err))
      return false
    }
  }

  return {
    // State
    currentNutrients,
    error,

    // Getters
    nutrientEmpty,
    mealCarbs,
    nutrientCount,

    // Helper functions
    calculateFiberContent,
    calculateNetCarbs,

    // Actions
    addNutrient,
    addEmptyNutrient,
    removeNutrient,
    updateNutrient,
    clearSession,
    duplicateSessionTo,
    loadOrCreateSession,
    saveSession
  }
})
