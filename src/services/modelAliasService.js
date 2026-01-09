/**
 * Model Alias Service
 * Auto-generates animal name aliases for models and handles alias resolution
 */

const redis = require('../models/redis')
const logger = require('../utils/logger')

// 100+ animal names for aliases
const ANIMAL_NAMES = [
  // Fast/Powerful - for high-performance models
  'tiger',
  'eagle',
  'falcon',
  'cheetah',
  'panther',
  'wolf',
  'shark',
  'hawk',
  'cobra',
  'viper',
  // Smart - for intelligent models
  'dolphin',
  'owl',
  'fox',
  'raven',
  'octopus',
  'elephant',
  'whale',
  'crow',
  'parrot',
  'gorilla',
  // Quick/Light - for fast models
  'rabbit',
  'hummingbird',
  'swift',
  'gazelle',
  'antelope',
  'deer',
  'sparrow',
  'swallow',
  'finch',
  'wren',
  // Mythical/Special
  'phoenix',
  'dragon',
  'unicorn',
  'griffin',
  'pegasus',
  'hydra',
  'sphinx',
  'chimera',
  'kraken',
  'leviathan',
  // Big cats
  'lion',
  'leopard',
  'jaguar',
  'lynx',
  'cougar',
  'bobcat',
  'ocelot',
  'puma',
  'caracal',
  'serval',
  // Bears and large animals
  'bear',
  'panda',
  'grizzly',
  'polar',
  'koala',
  'moose',
  'bison',
  'buffalo',
  'rhino',
  'hippo',
  // Marine animals
  'orca',
  'seal',
  'otter',
  'walrus',
  'narwhal',
  'marlin',
  'tuna',
  'barracuda',
  'manta',
  'stingray',
  // Birds of prey
  'condor',
  'vulture',
  'osprey',
  'kite',
  'harrier',
  'kestrel',
  'merlin',
  'buzzard',
  'goshawk',
  'peregrine',
  // Canines
  'coyote',
  'jackal',
  'dingo',
  'husky',
  'mastiff',
  'shepherd',
  'hound',
  'terrier',
  'collie',
  'boxer',
  // Primates
  'chimp',
  'baboon',
  'mandrill',
  'lemur',
  'tamarin',
  'macaque',
  'gibbon',
  'orangutan',
  'marmoset',
  'capuchin',
  // Exotic
  'mongoose',
  'meerkat',
  'badger',
  'wolverine',
  'weasel',
  'ferret',
  'mink',
  'stoat',
  'ermine',
  'sable',
  // More varied animals
  'penguin',
  'flamingo',
  'pelican',
  'stork',
  'heron',
  'crane',
  'egret',
  'ibis',
  'albatross',
  'petrel',
  // Reptiles
  'python',
  'anaconda',
  'mamba',
  'rattler',
  'iguana',
  'monitor',
  'gecko',
  'chameleon',
  'crocodile',
  'alligator'
]

class ModelAliasService {
  constructor() {
    this.ALIAS_PREFIX = 'model_alias:'
    this.REVERSE_PREFIX = 'model_alias_reverse:'
    this.ALIASES_SET_KEY = 'model_aliases_set'
  }

  /**
   * Generate a unique alias for a model
   * @param {string} realModel - The actual model name
   * @param {string} platform - Platform (claude, openai, gemini)
   * @returns {Promise<string>} Generated alias
   */
  async generateAlias(realModel, platform) {
    // Check if model already has an alias
    const existing = await this.getAliasByRealModel(realModel)
    if (existing) {
      logger.debug(`Model ${realModel} already has alias: ${existing}`)
      return existing
    }

    // Get all used aliases
    const usedAliases = await this.getAllUsedAliases()

    // Find first unused animal name
    let alias = ANIMAL_NAMES.find((animal) => !usedAliases.includes(animal))

    // If all animals are used, generate numbered alias
    if (!alias) {
      alias = this._generateNumberedAlias(usedAliases)
    }

    // Save the alias mapping
    await this.saveAlias(alias, realModel, platform)
    logger.info(`Generated alias '${alias}' for model '${realModel}' (${platform})`)

    return alias
  }

  /**
   * Generate a numbered alias when all animals are used
   * @param {string[]} usedAliases - Currently used aliases
   * @returns {string} Numbered alias (e.g., tiger-2, eagle-3)
   */
  _generateNumberedAlias(usedAliases) {
    for (const animal of ANIMAL_NAMES) {
      let num = 2
      while (num <= 100) {
        const candidate = `${animal}-${num}`
        if (!usedAliases.includes(candidate)) {
          return candidate
        }
        num++
      }
    }
    // Fallback: use timestamp-based name
    return `model-${Date.now()}`
  }

  /**
   * Save alias mapping to Redis
   * @param {string} alias - The alias name
   * @param {string} realModel - The actual model name
   * @param {string} platform - Platform (claude, openai, gemini)
   */
  async saveAlias(alias, realModel, platform) {
    const now = new Date().toISOString()
    const data = {
      realModel,
      platform,
      createdAt: now,
      lastVerified: now
    }

    // Use pipeline for atomic operations
    const pipeline = redis.pipeline()

    // Store alias -> model mapping
    pipeline.hmset(`${this.ALIAS_PREFIX}${alias}`, data)

    // Store reverse mapping: model -> alias
    pipeline.set(`${this.REVERSE_PREFIX}${realModel}`, alias)

    // Add to set of all aliases
    pipeline.sadd(this.ALIASES_SET_KEY, alias)

    await pipeline.exec()
  }

  /**
   * Get alias by real model name (reverse lookup)
   * @param {string} realModel - The actual model name
   * @returns {Promise<string|null>} Alias or null
   */
  async getAliasByRealModel(realModel) {
    return redis.get(`${this.REVERSE_PREFIX}${realModel}`)
  }

  /**
   * Resolve alias to real model name
   * @param {string} aliasOrModel - Alias or real model name
   * @returns {Promise<{realModel: string, platform: string|null}>} Resolved model info
   */
  async resolveAlias(aliasOrModel) {
    const data = await redis.hgetall(`${this.ALIAS_PREFIX}${aliasOrModel}`)

    if (data && data.realModel) {
      return {
        realModel: data.realModel,
        platform: data.platform || null,
        isAlias: true
      }
    }

    // Not an alias, return original
    return {
      realModel: aliasOrModel,
      platform: null,
      isAlias: false
    }
  }

  /**
   * Get all used aliases
   * @returns {Promise<string[]>} Array of used alias names
   */
  async getAllUsedAliases() {
    return redis.smembers(this.ALIASES_SET_KEY)
  }

  /**
   * Get all aliases with their mappings
   * @returns {Promise<Array<{alias: string, realModel: string, platform: string, createdAt: string}>>}
   */
  async getAllAliases() {
    const aliases = await this.getAllUsedAliases()
    const result = []

    for (const alias of aliases) {
      const data = await redis.hgetall(`${this.ALIAS_PREFIX}${alias}`)
      if (data && data.realModel) {
        result.push({
          alias,
          realModel: data.realModel,
          platform: data.platform,
          createdAt: data.createdAt,
          lastVerified: data.lastVerified
        })
      }
    }

    // Sort by platform, then by alias name
    result.sort((a, b) => {
      if (a.platform !== b.platform) {
        return a.platform.localeCompare(b.platform)
      }
      return a.alias.localeCompare(b.alias)
    })

    return result
  }

  /**
   * Get aliases filtered by platform
   * @param {string} platform - Platform to filter by
   * @returns {Promise<Array>} Filtered aliases
   */
  async getAliasesByPlatform(platform) {
    const all = await this.getAllAliases()
    return all.filter((a) => a.platform === platform)
  }

  /**
   * Delete an alias
   * @param {string} alias - Alias to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteAlias(alias) {
    const data = await redis.hgetall(`${this.ALIAS_PREFIX}${alias}`)
    if (!data || !data.realModel) {
      return false
    }

    const pipeline = redis.pipeline()
    pipeline.del(`${this.ALIAS_PREFIX}${alias}`)
    pipeline.del(`${this.REVERSE_PREFIX}${data.realModel}`)
    pipeline.srem(this.ALIASES_SET_KEY, alias)
    await pipeline.exec()

    logger.info(`Deleted alias '${alias}' for model '${data.realModel}'`)
    return true
  }

  /**
   * Update lastVerified timestamp for an alias
   * @param {string} alias - Alias to update
   */
  async updateLastVerified(alias) {
    await redis.hset(`${this.ALIAS_PREFIX}${alias}`, 'lastVerified', new Date().toISOString())
  }

  /**
   * Get statistics about aliases
   * @returns {Promise<{total: number, byPlatform: object}>}
   */
  async getStats() {
    const aliases = await this.getAllAliases()
    const byPlatform = {}

    for (const alias of aliases) {
      byPlatform[alias.platform] = (byPlatform[alias.platform] || 0) + 1
    }

    return {
      total: aliases.length,
      byPlatform
    }
  }

  /**
   * Bulk generate aliases for multiple models
   * @param {string[]} models - Array of model names
   * @param {string} platform - Platform
   * @returns {Promise<{generated: number, skipped: number}>}
   */
  async bulkGenerateAliases(models, platform) {
    let generated = 0
    let skipped = 0

    for (const model of models) {
      const existing = await this.getAliasByRealModel(model)
      if (existing) {
        skipped++
        await this.updateLastVerified(existing)
      } else {
        await this.generateAlias(model, platform)
        generated++
      }
    }

    return { generated, skipped }
  }

  /**
   * Clear all aliases (use with caution!)
   */
  async clearAllAliases() {
    const aliases = await this.getAllUsedAliases()

    if (aliases.length === 0) {
      return
    }

    const pipeline = redis.pipeline()

    for (const alias of aliases) {
      const data = await redis.hgetall(`${this.ALIAS_PREFIX}${alias}`)
      if (data && data.realModel) {
        pipeline.del(`${this.REVERSE_PREFIX}${data.realModel}`)
      }
      pipeline.del(`${this.ALIAS_PREFIX}${alias}`)
    }

    pipeline.del(this.ALIASES_SET_KEY)
    await pipeline.exec()

    logger.warn(`Cleared all ${aliases.length} model aliases`)
  }
}

// Export singleton instance
module.exports = new ModelAliasService()
