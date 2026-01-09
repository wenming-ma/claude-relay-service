/**
 * Admin Routes - Model Aliases Management
 * Handles listing, refreshing, and managing model aliases
 */

const express = require('express')
const { authenticateAdmin } = require('../../middleware/auth')
const modelAliasService = require('../../services/modelAliasService')
const modelFetcherService = require('../../services/modelFetcherService')
const claudeAccountService = require('../../services/claudeAccountService')
const openaiAccountService = require('../../services/openaiAccountService')
const geminiAccountService = require('../../services/geminiAccountService')
const logger = require('../../utils/logger')

const router = express.Router()

/**
 * GET /admin/model-aliases
 * List all model aliases
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { platform } = req.query

    let aliases
    if (platform && platform !== 'all') {
      aliases = await modelAliasService.getAliasesByPlatform(platform)
    } else {
      aliases = await modelAliasService.getAllAliases()
    }

    const stats = await modelAliasService.getStats()

    return res.json({
      success: true,
      data: {
        aliases,
        stats
      }
    })
  } catch (error) {
    logger.error('Failed to get model aliases:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get model aliases',
      message: error.message
    })
  }
})

/**
 * POST /admin/model-aliases/refresh
 * Refresh model aliases by fetching from official APIs
 */
router.post('/refresh', authenticateAdmin, async (req, res) => {
  try {
    const { platform } = req.body
    const results = {
      claude: { generated: 0, skipped: 0, error: null },
      openai: { generated: 0, skipped: 0, error: null },
      gemini: { generated: 0, skipped: 0, error: null }
    }

    // Fetch models from Claude accounts (only if accounts exist)
    if (!platform || platform === 'claude' || platform === 'all') {
      try {
        const claudeAccounts = await claudeAccountService.getAllAccounts()
        const activeAccounts = claudeAccounts.filter(
          (a) => a.isActive !== false && a.schedulable !== false
        )

        if (activeAccounts.length > 0) {
          // Use the first active account to fetch models
          const account = activeAccounts[0]
          const accessToken = await claudeAccountService.getValidAccessToken(account.id)
          const models = await modelFetcherService.fetchClaudeModels(accessToken, account.proxy || null)
          const result = await modelAliasService.bulkGenerateAliases(models, 'claude')
          results.claude = result
        }
        // No active accounts - skip (don't generate default aliases)
      } catch (error) {
        results.claude.error = error.message
        logger.warn('Failed to refresh Claude model aliases:', error.message)
      }
    }

    // Fetch models from OpenAI accounts (only if accounts exist)
    if (!platform || platform === 'openai' || platform === 'all') {
      try {
        const openaiAccounts = await openaiAccountService.getAllAccounts()
        const activeAccounts = openaiAccounts.filter(
          (a) => a.isActive !== false && a.schedulable !== false
        )

        if (activeAccounts.length > 0) {
          // Use the first active account to fetch models
          const accountSummary = activeAccounts[0]
          const account = await openaiAccountService.getAccount(accountSummary.id)
          const accessToken = openaiAccountService.decrypt(account.accessToken)
          const chatgptAccountId = account.accountId || account.chatgptUserId || accountSummary.id || null
          const models = await modelFetcherService.fetchOpenAIModels(accessToken, account.proxy || null, {
            chatgptAccountId
          })
          const result = await modelAliasService.bulkGenerateAliases(models, 'openai')
          results.openai = result
        }
        // No active accounts - skip (don't generate default aliases)
      } catch (error) {
        results.openai.error = error.message
        logger.warn('Failed to refresh OpenAI model aliases:', error.message)
      }
    }

    // Fetch models from Gemini accounts (only if accounts exist)
    if (!platform || platform === 'gemini' || platform === 'all') {
      try {
        const geminiAccounts = await geminiAccountService.getAllAccounts()
        const activeAccounts = geminiAccounts.filter(
          (a) => a.isActive !== false && a.schedulable !== false
        )

        if (activeAccounts.length > 0) {
          // Use the first active account to fetch models
          const accountSummary = activeAccounts[0]
          const account = await geminiAccountService.getAccount(accountSummary.id)
          const models = await modelFetcherService.fetchGeminiModels(account.accessToken, account.proxy || null)
          const result = await modelAliasService.bulkGenerateAliases(models, 'gemini')
          results.gemini = result
        }
        // No active accounts - skip (don't generate default aliases)
      } catch (error) {
        results.gemini.error = error.message
        logger.warn('Failed to refresh Gemini model aliases:', error.message)
      }
    }

    const totalGenerated =
      results.claude.generated + results.openai.generated + results.gemini.generated
    const totalSkipped = results.claude.skipped + results.openai.skipped + results.gemini.skipped

    logger.info(`🏷️ Model aliases refresh: ${totalGenerated} generated, ${totalSkipped} skipped`)

    return res.json({
      success: true,
      data: {
        results,
        summary: {
          totalGenerated,
          totalSkipped
        }
      }
    })
  } catch (error) {
    logger.error('Failed to refresh model aliases:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh model aliases',
      message: error.message
    })
  }
})

/**
 * DELETE /admin/model-aliases/:alias
 * Delete a specific alias
 */
router.delete('/:alias', authenticateAdmin, async (req, res) => {
  try {
    const { alias } = req.params
    const deleted = await modelAliasService.deleteAlias(alias)

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Alias not found'
      })
    }

    return res.json({
      success: true,
      message: `Alias '${alias}' deleted successfully`
    })
  } catch (error) {
    logger.error(`Failed to delete alias ${req.params.alias}:`, error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete alias',
      message: error.message
    })
  }
})

/**
 * DELETE /admin/model-aliases
 * Clear all aliases (use with caution!)
 */
router.delete('/', authenticateAdmin, async (req, res) => {
  try {
    const { confirm } = req.body

    if (confirm !== 'DELETE_ALL_ALIASES') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required',
        message: 'Please provide { "confirm": "DELETE_ALL_ALIASES" } to confirm'
      })
    }

    await modelAliasService.clearAllAliases()

    return res.json({
      success: true,
      message: 'All model aliases have been cleared'
    })
  } catch (error) {
    logger.error('Failed to clear all aliases:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to clear all aliases',
      message: error.message
    })
  }
})

/**
 * GET /admin/model-aliases/stats
 * Get alias statistics
 */
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await modelAliasService.getStats()

    return res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Failed to get alias stats:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get alias stats',
      message: error.message
    })
  }
})

module.exports = router
