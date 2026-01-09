#!/usr/bin/env node
/**
 * Clear all model aliases from Redis
 */

const redis = require('../src/models/redis')

async function clearAliases() {
  try {
    console.log('Connecting to Redis...')

    // Wait for Redis to connect
    await redis.connect()

    // Get all alias keys
    const aliasKeys = await redis.keys('model_alias:*')
    const reverseKeys = await redis.keys('model_alias_reverse:*')

    console.log(`Found ${aliasKeys.length} alias keys`)
    console.log(`Found ${reverseKeys.length} reverse keys`)

    if (aliasKeys.length === 0 && reverseKeys.length === 0) {
      console.log('No aliases to clear')
      await redis.disconnect()
      process.exit(0)
    }

    // Delete all alias keys
    if (aliasKeys.length > 0) {
      await redis.del(...aliasKeys)
      console.log(`Deleted ${aliasKeys.length} alias keys`)
    }

    // Delete all reverse keys
    if (reverseKeys.length > 0) {
      await redis.del(...reverseKeys)
      console.log(`Deleted ${reverseKeys.length} reverse keys`)
    }

    // Delete the set key
    await redis.del('model_aliases_set')
    console.log('Deleted model_aliases_set')

    console.log('\n✅ All model aliases cleared!')
    await redis.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

clearAliases()
