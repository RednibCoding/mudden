import BaseCommand from './BaseCommand.js'

class SystemCommands extends BaseCommand {
  getCommands() {
    return {
      // System
      // 'save': this.save.bind(this),
      'quit': this.quit.bind(this),
      'logout': this.logout.bind(this),
      'exit': this.quit.bind(this),
      'password': this.password.bind(this),
      'templates': this.templates.bind(this)
    }
  }

  save(player, args) {
    player.save()
    return "Game saved."
  }

  quit(player, args) {
    player.save()
    return "LOGOUT_REQUEST|Goodbye! Your progress has been saved."
  }

  logout(player, args) {
    player.save()
    return "LOGOUT_REQUEST|Logged out successfully. You can now login with a different character."
  }

  password(player, args) {
    if (!args || args.length === 0) {
      return "Usage: password <new password>"
    }

    const newPassword = args.join(' ')
    
    if (newPassword.length < 3) {
      return "Password must be at least 3 characters long."
    }

    try {
      player.setPassword(newPassword)
      player.save()
      return "Password changed successfully!"
    } catch (error) {
      console.error('Password change error:', error)
      return "Error changing password. Please try again."
    }
  }

  templates(player, args) {
    if (!args || args.length === 0) {
      // Show template counts
            const counts = this.worldManager.templateManager.getTemplateCounts()
      return `Template Manager Status:
Areas: ${counts.areas}
Items: ${counts.items}
Enemies: ${counts.enemies}
NPCs: ${counts.npcs}
Quests: ${counts.quests}

Usage: templates <reload|item|enemy|npc|quest> [id]`
    }

    const command = args[0].toLowerCase()
    const id = args[1]

    switch (command) {
      case 'reload':
        try {
                    this.worldManager.templateManager.reloadAllTemplates()
          return "All templates reloaded successfully!"
        } catch (error) {
          return `Error reloading templates: ${error.message}`
        }

      case 'item':
        if (!id) return "Usage: templates item <item_id>"
                const enrichedItem = this.worldManager.templateManager.getEnrichedItem(id)
        if (!enrichedItem) return `Item '${id}' not found.`
        return `Item: ${enrichedItem.displayName}
Equippable: ${enrichedItem.isEquippable}
Consumable: ${enrichedItem.isConsumable}
Readable: ${enrichedItem.isReadable}
Has Stats: ${enrichedItem.hasStats}`

      case 'enemy':
        if (!id) return "Usage: templates enemy <enemy_id>"
                const enrichedEnemy = this.worldManager.templateManager.getEnrichedEnemy(id)
        if (!enrichedEnemy) return `Enemy '${id}' not found.`
        return `Enemy: ${enrichedEnemy.displayName}
Health: ${enrichedEnemy.currentHealth}/${enrichedEnemy.maxHealth}
Damage: ${enrichedEnemy.damage[0]}-${enrichedEnemy.damage[1]}
Defense: ${enrichedEnemy.defense}
Accuracy: ${enrichedEnemy.accuracy}%`

      case 'npc':
        if (!id) return "Usage: templates npc <npc_id>"
                const enrichedNPC = this.worldManager.templateManager.getEnrichedNPC(id)
        if (!enrichedNPC) return `NPC '${id}' not found.`
        return `NPC: ${enrichedNPC.displayName}
Has Dialogue: ${enrichedNPC.hasDialogue}
Has Quests: ${enrichedNPC.hasQuests}
Can Trade: ${enrichedNPC.canTrade}`

      case 'quest':
        if (!id) return "Usage: templates quest <quest_id>"
                const enrichedQuest = this.worldManager.templateManager.getEnrichedQuest(id)
        if (!enrichedQuest) return `Quest '${id}' not found.`
        return `Quest: ${enrichedQuest.displayName}
Has Rewards: ${enrichedQuest.hasRewards}
Has Requirements: ${enrichedQuest.hasRequirements}
Steps: ${enrichedQuest.stepCount}`

      default:
        return "Usage: templates <reload|item|enemy|npc|quest> [id]"
    }
  }
}

export default SystemCommands