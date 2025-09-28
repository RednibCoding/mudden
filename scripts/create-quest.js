#!/usr/bin/env node

/**
 * Quest Generator Script
 * 
 * Usage: node scripts/create-quest.js [quest-id]
 * 
 * This script helps create new quest files with the proper structure.
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve)
  })
}

async function createQuest() {
  console.log('🗡️  MUD Quest Generator')
  console.log('========================\n')

  const questId = process.argv[2] || await prompt('Quest ID (e.g., blacksmith_new_task): ')
  
  if (!questId) {
    console.error('❌ Quest ID is required')
    process.exit(1)
  }

  const title = await prompt('Quest Title: ')
  const description = await prompt('Brief Description: ')
  const questGiver = await prompt('Quest Giver NPC ID: ')
  const type = await prompt('Quest Type (gather/kill/fetch): ')
  const level = await prompt('Required Level (default: 1): ') || '1'
  const questText = await prompt('Quest Dialogue Text: ')
  const completionText = await prompt('Completion Text: ')
  const repeatable = await prompt('Repeatable? (y/n, default: y): ') || 'y'
  
  const questData = {
    title: title || 'New Quest',
    description: description || 'A new quest awaits.',
    questGiver: questGiver || 'unknown_npc',
    type: type || 'gather',
    levelRequired: parseInt(level),
    objectives: {
      [type || 'gather']: [
        {
          item: 'example_item',
          quantity: 1,
          description: 'Complete the objective'
        }
      ]
    },
    rewards: {
      gold: 50,
      xp: 100,
      items: []
    },
    questText: questText || 'I have a task for you...',
    completionText: completionText || 'Well done! Here is your reward.',
    repeatable: repeatable.toLowerCase() === 'y',
    requirements: {
      level: parseInt(level),
      completedQuests: []
    }
  }

  const questsDir = path.join(__dirname, '..', 'data', 'quests')
  const questFile = path.join(questsDir, `${questId}.json`)

  if (fs.existsSync(questFile)) {
    const overwrite = await prompt(`❓ Quest file ${questId}.json already exists. Overwrite? (y/n): `)
    if (overwrite.toLowerCase() !== 'y') {
      console.log('❌ Quest creation cancelled.')
      rl.close()
      return
    }
  }

  try {
    fs.writeFileSync(questFile, JSON.stringify(questData, null, 2))
    console.log(`\n✅ Quest created successfully!`)
    console.log(`📁 File: ${questFile}`)
    console.log(`\n⚠️  Remember to:`)
    console.log(`   1. Update the objectives with actual items/enemies/NPCs`)
    console.log(`   2. Set appropriate rewards`)
    console.log(`   3. Add the quest to the appropriate NPC's dialogue`)
    console.log(`   4. Test the quest in-game`)
  } catch (error) {
    console.error(`❌ Error creating quest file:`, error.message)
  }

  rl.close()
}

// Run the script
createQuest().catch(console.error)