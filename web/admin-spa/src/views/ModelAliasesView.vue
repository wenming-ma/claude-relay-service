<template>
  <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">模型别名</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          使用动物名称作为模型别名，方便在 Cursor 等客户端中使用
        </p>
      </div>
      <div class="flex gap-2">
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          :disabled="refreshing"
          @click="handleRefresh"
        >
          <i class="fas fa-sync-alt" :class="{ 'animate-spin': refreshing }" />
          {{ refreshing ? '刷新中...' : '刷新模型' }}
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
        <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.total }}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">总别名数</div>
      </div>
      <div
        v-for="(count, platform) in stats.byPlatform"
        :key="platform"
        class="rounded-lg bg-white p-4 shadow dark:bg-gray-800"
      >
        <div class="text-2xl font-bold" :class="getPlatformColor(platform)">{{ count }}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">{{ getPlatformLabel(platform) }}</div>
      </div>
    </div>

    <!-- Filter -->
    <div class="mb-4 flex items-center gap-2">
      <span class="text-sm text-gray-600 dark:text-gray-400">平台筛选:</span>
      <div class="flex gap-1">
        <button
          v-for="platform in platformOptions"
          :key="platform"
          class="rounded-md px-3 py-1 text-sm font-medium transition-colors"
          :class="
            selectedPlatform === platform
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          "
          @click="setSelectedPlatform(platform)"
        >
          {{ platform === 'all' ? '全部' : getPlatformLabel(platform) }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <i class="fas fa-spinner fa-spin mb-2 text-4xl text-blue-500" />
        <p class="text-gray-500 dark:text-gray-400">加载中...</p>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredAliases.length === 0"
      class="rounded-lg bg-white p-12 text-center shadow dark:bg-gray-800"
    >
      <i class="fas fa-tags mb-4 text-5xl text-gray-400" />
      <h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">暂无模型别名</h3>
      <p class="mb-4 text-gray-500 dark:text-gray-400">
        点击"刷新模型"按钮从已配置的账户中获取可用模型并生成别名
      </p>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        :disabled="refreshing"
        @click="handleRefresh"
      >
        <i class="fas fa-sync-alt" />
        刷新模型
      </button>
    </div>

    <!-- Aliases Table -->
    <div v-else class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              别名
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              真实模型
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              平台
            </th>
            <th
              class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr
            v-for="alias in filteredAliases"
            :key="alias.alias"
            class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <td class="whitespace-nowrap px-6 py-4">
              <div class="flex items-center gap-2">
                <code
                  class="rounded bg-gray-100 px-2 py-1 font-mono text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                >
                  {{ alias.alias }}
                </code>
                <button
                  class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-300"
                  title="复制别名"
                  @click="copyToClipboard(alias.alias)"
                >
                  <i class="fas fa-copy" />
                </button>
              </div>
            </td>
            <td class="whitespace-nowrap px-6 py-4">
              <code class="text-sm text-gray-600 dark:text-gray-400" :title="alias.realModel">
                {{ truncateModel(alias.realModel) }}
              </code>
            </td>
            <td class="whitespace-nowrap px-6 py-4">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="getPlatformBadgeClass(alias.platform)"
              >
                <i :class="getPlatformIcon(alias.platform)" />
                {{ getPlatformLabel(alias.platform) }}
              </span>
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-right">
              <button
                class="text-red-600 transition-colors hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                title="删除别名"
                @click="handleDelete(alias.alias)"
              >
                <i class="fas fa-trash" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Usage Guide -->
    <div class="mt-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
      <h3 class="mb-2 flex items-center gap-2 font-medium text-blue-800 dark:text-blue-300">
        <i class="fas fa-info-circle" />
        使用说明
      </h3>
      <div class="space-y-2 text-sm text-blue-700 dark:text-blue-300">
        <p>1. 在 Cursor 设置中配置 API 地址为本服务地址</p>
        <p>
          2. 在模型名称处填写上表中的<strong>别名</strong>（如
          <code class="rounded bg-blue-200 px-1 dark:bg-blue-800">tiger</code>）
        </p>
        <p>3. 服务会自动将别名转换为真实模型名称进行请求</p>
        <p class="text-xs opacity-75">
          提示：别名使用动物名称，便于记忆且可绕过某些地区对模型名称的限制
        </p>
      </div>
    </div>

    <!-- Toast for copy feedback -->
    <div
      v-if="showCopyToast"
      class="fixed bottom-4 right-4 z-50 rounded-lg bg-green-600 px-4 py-2 text-white shadow-lg"
    >
      <i class="fas fa-check mr-2" />
      已复制到剪贴板
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useModelAliasesStore } from '@/stores/modelAliases'
import { storeToRefs } from 'pinia'

const store = useModelAliasesStore()
const { stats, loading, refreshing, selectedPlatform, filteredAliases, platformOptions } =
  storeToRefs(store)
const { fetchAliases, refreshAliases, deleteAlias, setSelectedPlatform } = store

const showCopyToast = ref(false)

onMounted(() => {
  fetchAliases()
})

const handleRefresh = async () => {
  try {
    await refreshAliases()
  } catch (error) {
    console.error('Failed to refresh aliases:', error)
  }
}

const handleDelete = async (alias) => {
  if (confirm(`确定要删除别名 "${alias}" 吗？`)) {
    try {
      await deleteAlias(alias)
    } catch (error) {
      console.error('Failed to delete alias:', error)
    }
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    showCopyToast.value = true
    setTimeout(() => {
      showCopyToast.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

const truncateModel = (model) => {
  if (model.length > 35) {
    return model.substring(0, 35) + '...'
  }
  return model
}

const getPlatformLabel = (platform) => {
  const labels = {
    claude: 'Claude',
    openai: 'OpenAI',
    gemini: 'Gemini'
  }
  return labels[platform] || platform
}

const getPlatformColor = (platform) => {
  const colors = {
    claude: 'text-purple-600 dark:text-purple-400',
    openai: 'text-green-600 dark:text-green-400',
    gemini: 'text-yellow-600 dark:text-yellow-400'
  }
  return colors[platform] || 'text-gray-600 dark:text-gray-400'
}

const getPlatformBadgeClass = (platform) => {
  const classes = {
    claude: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    openai: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    gemini: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  }
  return classes[platform] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
}

const getPlatformIcon = (platform) => {
  const icons = {
    claude: 'fas fa-brain',
    openai: 'fas fa-robot',
    gemini: 'fas fa-gem'
  }
  return icons[platform] || 'fas fa-cube'
}
</script>
