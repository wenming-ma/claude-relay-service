import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/config/api'

export const useModelAliasesStore = defineStore('modelAliases', () => {
  // State
  const aliases = ref([])
  const stats = ref({ total: 0, byPlatform: {} })
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref(null)
  const selectedPlatform = ref('all')

  // Computed
  const filteredAliases = computed(() => {
    if (selectedPlatform.value === 'all') {
      return aliases.value
    }
    return aliases.value.filter((a) => a.platform === selectedPlatform.value)
  })

  const platformOptions = computed(() => {
    const platforms = ['all']
    if (stats.value.byPlatform) {
      Object.keys(stats.value.byPlatform).forEach((p) => {
        if (!platforms.includes(p)) {
          platforms.push(p)
        }
      })
    }
    return platforms
  })

  // Actions
  const fetchAliases = async () => {
    loading.value = true
    error.value = null
    try {
      const response = await apiClient.get('/admin/model-aliases')
      if (response.success) {
        aliases.value = response.data?.aliases || []
        stats.value = response.data?.stats || { total: 0, byPlatform: {} }
      } else {
        throw new Error(response.message || 'Failed to fetch model aliases')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const refreshAliases = async (platform = null) => {
    refreshing.value = true
    error.value = null
    try {
      const response = await apiClient.post('/admin/model-aliases/refresh', {
        platform: platform || 'all'
      })
      if (response.success) {
        // Reload the aliases after refresh
        await fetchAliases()
        return response.data
      } else {
        throw new Error(response.message || 'Failed to refresh model aliases')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      refreshing.value = false
    }
  }

  const deleteAlias = async (alias) => {
    try {
      const response = await apiClient.delete(`/admin/model-aliases/${alias}`)
      if (response.success) {
        // Remove from local state
        aliases.value = aliases.value.filter((a) => a.alias !== alias)
        // Update stats
        await fetchAliases()
      } else {
        throw new Error(response.message || 'Failed to delete alias')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const clearAllAliases = async () => {
    try {
      const response = await apiClient.delete('/admin/model-aliases', {
        data: { confirm: 'DELETE_ALL_ALIASES' }
      })
      if (response.success) {
        aliases.value = []
        stats.value = { total: 0, byPlatform: {} }
      } else {
        throw new Error(response.message || 'Failed to clear aliases')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const setSelectedPlatform = (platform) => {
    selectedPlatform.value = platform
  }

  return {
    // State
    aliases,
    stats,
    loading,
    refreshing,
    error,
    selectedPlatform,
    // Computed
    filteredAliases,
    platformOptions,
    // Actions
    fetchAliases,
    refreshAliases,
    deleteAlias,
    clearAllAliases,
    setSelectedPlatform
  }
})
