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

  _applyProxy(requestOptions, proxy) {
    const proxyAgent = ProxyHelper.createProxyAgent(proxy)
    if (proxyAgent) {
      requestOptions.httpAgent = proxyAgent
      requestOptions.httpsAgent = proxyAgent
      requestOptions.proxy = false
    }
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

      this._applyProxy(requestOptions, proxy)

      const response = await axios(requestOptions)

      if (response.status !== 200) {
        logger.error(`Failed to fetch Claude models: ${response.status} ${response.statusText}`, {
          responseData: response.data
        })
        return []
      }

      // Extract model IDs from response
      const models = response.data?.data || response.data?.models || []
      const modelIds = models.map((m) => m.id || m.name).filter(Boolean)

      if (modelIds.length === 0) {
        logger.error('Claude API returned empty model list')
        return []
      }

      logger.info(`Fetched ${modelIds.length} models from Claude API`)
      return modelIds
    } catch (error) {
      logger.error(`Error fetching Claude models: ${error.message}`, {
        stack: error.stack
      })
      return []
    }
  }

  /**
   * Fetch models from OpenAI API
   * @param {string} accessToken - OAuth access token
   * @param {object|null} proxy - Proxy configuration
   * @param {object} meta - optional metadata
   * @param {string} meta.chatgptAccountId - ChatGPT account id for backend-api calls
   * @returns {Promise<string[]>} Array of model IDs
   */
  async fetchOpenAIModels(accessToken, proxy = null, meta = {}) {
    if (!accessToken) {
      logger.error('Error fetching OpenAI models: missing accessToken')
      return []
    }

    // If it looks like a Platform API key, use api.openai.com; otherwise use ChatGPT backend-api.
    const token = String(accessToken)
    const looksLikeApiKey = token.startsWith('sk-')
    return looksLikeApiKey
      ? this._fetchOpenAIModelsFromPlatform(token, proxy)
      : this._fetchOpenAIModelsFromChatGPT(token, proxy, meta)
  }

  async _fetchOpenAIModelsFromPlatform(apiKey, proxy = null) {
    try {
      const requestOptions = {
        method: 'GET',
        url: 'https://api.openai.com/v1/models',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout,
        validateStatus: () => true
      }

      this._applyProxy(requestOptions, proxy)

      const response = await axios(requestOptions)

      if (response.status !== 200) {
        logger.error(`Failed to fetch OpenAI models: ${response.status} ${response.statusText}`, {
          responseData: response.data
        })
        return []
      }

      // Extract model IDs from response
      const models = response.data?.data || []
      // Filter to only include relevant models (gpt, codex, etc.)
      const relevantModels = models
        .map((m) => m.id)
        .filter((id) => id && (id.includes('gpt') || id.includes('codex') || id.includes('o1')))

      if (relevantModels.length === 0) {
        logger.error('OpenAI API returned no relevant models (gpt/codex/o1)')
        return []
      }

      logger.info(`Fetched ${relevantModels.length} relevant models from OpenAI API`)
      return relevantModels
    } catch (error) {
      logger.error(`Error fetching OpenAI models: ${error.message}`, {
        stack: error.stack
      })
      return []
    }
  }

  async _fetchOpenAIModelsFromChatGPT(accessToken, proxy = null, meta = {}) {
    try {
      // ChatGPT backend-api often blocks non-browser user agents.
      // Use browser-like headers to reduce the chance of WAF/Cloudflare returning HTML.
      const userAgent =
        process.env.OPENAI_MODELS_FETCH_UA ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

      const requestOptions = {
        method: 'GET',
        url: 'https://chatgpt.com/backend-api/models',
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
          'content-type': 'application/json',
          host: 'chatgpt.com',
          'user-agent': userAgent,
          origin: 'https://chatgpt.com',
          referer: 'https://chatgpt.com/',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        timeout: this.timeout,
        validateStatus: () => true
      }

      if (meta?.chatgptAccountId) {
        requestOptions.headers['chatgpt-account-id'] = meta.chatgptAccountId
      }

      this._applyProxy(requestOptions, proxy)

      const response = await axios(requestOptions)

      const contentType = String(response.headers?.['content-type'] || '')
      const isHtml =
        contentType.includes('text/html') ||
        (typeof response.data === 'string' && response.data.trim().startsWith('<html'))

      if (response.status !== 200) {
        logger.error(
          `Failed to fetch OpenAI models from ChatGPT backend-api: ${response.status} ${response.statusText}`,
          {
            contentType,
            isHtml,
            responseData: response.data
          }
        )
        return []
      }

      if (isHtml) {
        logger.error('ChatGPT backend-api returned HTML instead of JSON when fetching models', {
          contentType
        })
        return []
      }

      const raw =
        response.data?.models ||
        response.data?.data ||
        (Array.isArray(response.data) ? response.data : null)

      const list = Array.isArray(raw) ? raw : []
      const modelIds = list
        .map((m) => {
          if (!m) {
            return null
          }
          if (typeof m === 'string') {
            return m
          }
          return m.slug || m.id || m.name || null
        })
        .filter(Boolean)

      // Filter to only include relevant models (gpt, codex, etc.)
      const relevantModels = modelIds.filter(
        (id) => id && (id.includes('gpt') || id.includes('codex') || id.includes('o1'))
      )

      if (relevantModels.length === 0) {
        logger.error('ChatGPT backend-api returned no relevant models (gpt/codex/o1)', {
          sample: modelIds.slice(0, 20)
        })
        return []
      }

      logger.info(`Fetched ${relevantModels.length} relevant models from ChatGPT backend-api`)
      return [...new Set(relevantModels)]
    } catch (error) {
      logger.error(`Error fetching OpenAI models from ChatGPT backend-api: ${error.message}`, {
        stack: error.stack
      })
      return []
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

      this._applyProxy(requestOptions, proxy)

      const response = await axios(requestOptions)

      if (response.status !== 200) {
        logger.error(`Failed to fetch Gemini models: ${response.status} ${response.statusText}`, {
          responseData: response.data
        })
        return []
      }

      // Extract model IDs from response (remove 'models/' prefix if present)
      const models = response.data?.models || []
      const modelIds = models
        .map((m) => {
          const name = m.name || m.id || ''
          return name.replace(/^models\//, '')
        })
        .filter((id) => id && id.includes('gemini'))

      if (modelIds.length === 0) {
        logger.error('Gemini API returned no Gemini models')
        return []
      }

      logger.info(`Fetched ${modelIds.length} Gemini models from API`)
      return modelIds
    } catch (error) {
      logger.error(`Error fetching Gemini models: ${error.message}`, {
        stack: error.stack
      })
      return []
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

}

// Export singleton instance
module.exports = new ModelFetcherService()
