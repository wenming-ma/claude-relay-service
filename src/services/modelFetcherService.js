/**
 * Model Fetcher Service
 * Fetches available models from Claude/OpenAI/Gemini official APIs
 */

const axios = require('axios')
const ProxyHelper = require('../utils/proxyHelper')
const logger = require('../utils/logger')

class ModelFetcherService {
  constructor() {
    this.timeout = 30000 // 30 seconds timeout
  }

  /**
   * Fetch models from Claude API
   * @param {string} accessToken - OAuth access token
   * @param {object|null} proxy - Proxy configuration
   * @returns {Promise<string[]>} Array of model IDs
   */
  async fetchClaudeModels(accessToken, proxy = null) {
    try {
      const requestOptions = {
        method: 'GET',
        url: 'https://api.anthropic.com/v1/models',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: this.timeout,
        validateStatus: () => true
      }

      // Configure proxy if provided
      const proxyAgent = ProxyHelper.createProxyAgent(proxy)
      if (proxyAgent) {
        requestOptions.httpAgent = proxyAgent
        requestOptions.httpsAgent = proxyAgent
        requestOptions.proxy = false
      }

      const response = await axios(requestOptions)

      if (response.status !== 200) {
        logger.warn(`Failed to fetch Claude models: ${response.status} ${response.statusText}`)
        return this._getDefaultClaudeModels()
      }

      // Extract model IDs from response
      const models = response.data?.data || response.data?.models || []
      const modelIds = models.map((m) => m.id || m.name).filter(Boolean)

      logger.info(`Fetched ${modelIds.length} models from Claude API`)
      return modelIds.length > 0 ? modelIds : this._getDefaultClaudeModels()
    } catch (error) {
      logger.warn(`Error fetching Claude models: ${error.message}`)
      return this._getDefaultClaudeModels()
    }
  }

  /**
   * Fetch models from OpenAI API
   * @param {string} accessToken - OAuth access token
   * @param {object|null} proxy - Proxy configuration
   * @returns {Promise<string[]>} Array of model IDs
   */
  async fetchOpenAIModels(accessToken, proxy = null) {
    try {
      const requestOptions = {
        method: 'GET',
        url: 'https://api.openai.com/v1/models',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout,
        validateStatus: () => true
      }

      // Configure proxy if provided
      const proxyAgent = ProxyHelper.createProxyAgent(proxy)
      if (proxyAgent) {
        requestOptions.httpAgent = proxyAgent
        requestOptions.httpsAgent = proxyAgent
        requestOptions.proxy = false
      }

      const response = await axios(requestOptions)

      if (response.status !== 200) {
        logger.warn(`Failed to fetch OpenAI models: ${response.status} ${response.statusText}`)
        return this._getDefaultOpenAIModels()
      }

      // Extract model IDs from response
      const models = response.data?.data || []
      // Filter to only include relevant models (gpt, codex, etc.)
      const relevantModels = models
        .map((m) => m.id)
        .filter((id) => id && (id.includes('gpt') || id.includes('codex') || id.includes('o1')))

      logger.info(`Fetched ${relevantModels.length} relevant models from OpenAI API`)
      return relevantModels.length > 0 ? relevantModels : this._getDefaultOpenAIModels()
    } catch (error) {
      logger.warn(`Error fetching OpenAI models: ${error.message}`)
      return this._getDefaultOpenAIModels()
    }
  }

  /**
   * Fetch models from Gemini API
   * @param {string} accessToken - OAuth access token
   * @param {object|null} proxy - Proxy configuration
   * @returns {Promise<string[]>} Array of model IDs
   */
  async fetchGeminiModels(accessToken, proxy = null) {
    try {
      const requestOptions = {
        method: 'GET',
        url: 'https://generativelanguage.googleapis.com/v1/models',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout,
        validateStatus: () => true
      }

      // Configure proxy if provided
      const proxyAgent = ProxyHelper.createProxyAgent(proxy)
      if (proxyAgent) {
        requestOptions.httpAgent = proxyAgent
        requestOptions.httpsAgent = proxyAgent
        requestOptions.proxy = false
      }

      const response = await axios(requestOptions)

      if (response.status !== 200) {
        logger.warn(`Failed to fetch Gemini models: ${response.status} ${response.statusText}`)
        return this._getDefaultGeminiModels()
      }

      // Extract model IDs from response (remove 'models/' prefix if present)
      const models = response.data?.models || []
      const modelIds = models
        .map((m) => {
          const name = m.name || m.id || ''
          return name.replace(/^models\//, '')
        })
        .filter((id) => id && id.includes('gemini'))

      logger.info(`Fetched ${modelIds.length} Gemini models from API`)
      return modelIds.length > 0 ? modelIds : this._getDefaultGeminiModels()
    } catch (error) {
      logger.warn(`Error fetching Gemini models: ${error.message}`)
      return this._getDefaultGeminiModels()
    }
  }

  /**
   * Fetch models for a specific platform
   * @param {string} platform - Platform name (claude, openai, gemini)
   * @param {string} accessToken - OAuth access token
   * @param {object|null} proxy - Proxy configuration
   * @returns {Promise<string[]>} Array of model IDs
   */
  async fetchModels(platform, accessToken, proxy = null) {
    const platformLower = platform.toLowerCase()

    switch (platformLower) {
      case 'claude':
      case 'claude-official':
        return this.fetchClaudeModels(accessToken, proxy)
      case 'openai':
      case 'openai-responses':
        return this.fetchOpenAIModels(accessToken, proxy)
      case 'gemini':
        return this.fetchGeminiModels(accessToken, proxy)
      default:
        logger.warn(`Unknown platform for model fetching: ${platform}`)
        return []
    }
  }

  /**
   * Default Claude models (fallback when API fails)
   */
  _getDefaultClaudeModels() {
    return [
      'claude-opus-4-5-20251101',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ]
  }

  /**
   * Default OpenAI models (fallback when API fails)
   */
  _getDefaultOpenAIModels() {
    return [
      'gpt-5',
      'gpt-5-mini',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'o1',
      'o1-mini',
      'o1-pro'
    ]
  }

  /**
   * Default Gemini models (fallback when API fails)
   */
  _getDefaultGeminiModels() {
    return [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-3-pro-preview'
    ]
  }
}

// Export singleton instance
module.exports = new ModelFetcherService()
