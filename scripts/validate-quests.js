#!/usr/bin/env node

/**
 * Quest Validation Script
 * 
 * Usage: node scripts/validate-quests.js
 * 
 * This script validates all quest files for proper structure and required fields.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const questsDir = path.join(__dirname, '..', 'data', 'quests')
const requiredFields = ['title', 'description', 'questGiver', 'type', 'objectives', 'rewards', 'questText', 'completionText', 'repeatable', 'requirements']

function validateQuest(questData, filename) {
  const errors = []
  
  // Check required fields
  for (const field of requiredFields) {
    if (!questData.hasOwnProperty(field)) {
      errors.push(`Missing required field: ${field}`)
    }
  }
  
  // ID is derived from filename, so no validation needed
  
  // Validate quest type
  const validTypes = ['gather', 'kill', 'fetch']
  if (questData.type && !validTypes.includes(questData.type)) {
    errors.push(`Invalid quest type '${questData.type}'. Must be one of: ${validTypes.join(', ')}`)
  }
  
  // Validate objectives structure
  if (questData.objectives) {
    const hasObjectives = Object.keys(questData.objectives).some(type => 
      Array.isArray(questData.objectives[type]) && questData.objectives[type].length > 0
    )
    if (!hasObjectives) {
      errors.push('Quest must have at least one objective')
    }
  }
  
  // Validate requirements structure
  if (questData.requirements) {
    if (!questData.requirements.hasOwnProperty('level')) {
      errors.push('Requirements must include a level field')
    }
    if (!questData.requirements.hasOwnProperty('completedQuests')) {
      errors.push('Requirements must include a completedQuests array')
    }
  }
  
  return errors
}

async function validateAllQuests() {
  console.log('🔍 Validating Quest Files')
  console.log('=========================\n')
  
  try {
    const files = fs.readdirSync(questsDir)
    const questFiles = files.filter(file => file.endsWith('.json'))
    
    if (questFiles.length === 0) {
      console.log('⚠️  No quest files found in data/quests/')
      return
    }
    
    let totalQuests = 0
    let validQuests = 0
    const allErrors = []
    
    for (const file of questFiles) {
      totalQuests++
      const filePath = path.join(questsDir, file)
      
      try {
        const questData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const errors = validateQuest(questData, file)
        
        if (errors.length === 0) {
          console.log(`✅ ${file} - Valid`)
          validQuests++
        } else {
          console.log(`❌ ${file} - Errors:`)
          errors.forEach(error => console.log(`   - ${error}`))
          allErrors.push({ file, errors })
        }
      } catch (parseError) {
        console.log(`❌ ${file} - JSON Parse Error: ${parseError.message}`)
        allErrors.push({ file, errors: [`JSON Parse Error: ${parseError.message}`] })
      }
    }
    
    console.log(`\n📊 Summary:`)
    console.log(`   Total Quests: ${totalQuests}`)
    console.log(`   Valid Quests: ${validQuests}`)
    console.log(`   Invalid Quests: ${totalQuests - validQuests}`)
    
    if (allErrors.length === 0) {
      console.log(`\n🎉 All quest files are valid!`)
      process.exit(0)
    } else {
      console.log(`\n❌ ${allErrors.length} quest file(s) have errors. Please fix them before proceeding.`)
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Error reading quests directory:', error.message)
    process.exit(1)
  }
}

// Run validation
validateAllQuests().catch(console.error)