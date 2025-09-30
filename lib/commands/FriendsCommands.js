import BaseCommand from './BaseCommand.js'
import Player from '../Player.js'

class FriendsCommands extends BaseCommand {
  getCommands() {
    return {
      'friends': this.friends.bind(this),
      'f': this.friends.bind(this)
    }
  }

  friends(player, args) {
    if (args.length === 0) {
      return this.friendsList(player)
    }

    const subCommand = args[0].toLowerCase()
    
    switch (subCommand) {
      case 'list':
        return this.friendsList(player)
      case 'add':
        if (args.length < 2) {
          return "Usage: friends|f add <playername>"
        }
        return this.friendsAdd(player, args.slice(1).join(' '))
      case 'remove':
        if (args.length < 2) {
          return "Usage: friends|f remove <playername>"
        }
        return this.friendsRemove(player, args.slice(1).join(' '))
      case 'note':
        if (args.length < 2) {
          return "Usage: friends|f note <playername> [message] (empty message clears note)"
        }
        const friendName = args[1]
        const noteMessage = args.slice(2).join(' ') || ''
        return this.friendsNote(player, friendName, noteMessage)
      default:
        return "Usage: friends|f [list|add <name>|remove <name>|note <name> <message>]"
    }
  }

  friendsList(player) {
    // Initialize friends list if it doesn't exist
    if (!player.friends) {
      player.friends = []
    }

    if (player.friends.length === 0) {
      return "Your friends list is empty. Use 'friends add <playername>' to add friends."
    }

    let result = "\n=== Friends List ===\n"
    
    // Get list of online players for status check
    const playerList = this.players instanceof Map ? 
      Array.from(this.players.values()) : 
      Object.values(this.players)
    
    // Separate friends into online and offline lists with their data
    const onlineFriends = []
    const offlineFriends = []
    
    for (const friendName of player.friends) {
      // Check if friend is currently online
      const onlinePlayer = playerList.find(p => 
        p && p.name && p.name.toLowerCase() === friendName.toLowerCase()
      )
      
      if (onlinePlayer) {
        // Friend is online - use current level and get note
        const friendNote = this.getFriendNote(player, friendName)
        onlineFriends.push({
          name: friendName,
          level: onlinePlayer.level,
          status: 'online',
          note: friendNote
        })
      } else {
        // Friend is offline - load their data to get level
        try {
          const friendData = Player.loadCharacter(friendName)
          if (friendData) {
            const level = friendData.level || 1
            const friendNote = this.getFriendNote(player, friendName)
            offlineFriends.push({
              name: friendName,
              level: level,
              status: 'offline',
              note: friendNote
            })
          } else {
            // Friend data couldn't be loaded (character might have been deleted) - treat as offline without level
            const friendNote = this.getFriendNote(player, friendName)
            offlineFriends.push({
              name: friendName,
              level: null,
              status: 'offline',
              note: friendNote
            })
          }
        } catch (error) {
          // Error loading friend data - treat as offline without level
          const friendNote = this.getFriendNote(player, friendName)
          offlineFriends.push({
            name: friendName,
            level: null,
            status: 'offline',
            note: friendNote
          })
        }
      }
    }
    
    // Display online friends first, then offline friends
    let counter = 1
    
    for (const friend of onlineFriends) {
      let line = `${counter}. ${friend.name} - lv${friend.level} [online]`
      if (friend.note) {
        line += ` (${friend.note})`
      }
      result += line + '\n'
      counter++
    }
    
    for (const friend of offlineFriends) {
      let line = `${counter}. ${friend.name}`
      if (friend.level !== null) {
        line += ` - lv${friend.level}`
      }
      line += ' [offline]'
      if (friend.note) {
        line += ` (${friend.note})`
      }
      result += line + '\n'
      counter++
    }
    
    return result
  }

  friendsAdd(player, friendName) {
    // Initialize friends list if it doesn't exist
    if (!player.friends) {
      player.friends = []
    }

    // Format name with proper case (first letter uppercase, rest lowercase)
    const formattedName = friendName.charAt(0).toUpperCase() + friendName.slice(1).toLowerCase()
    
    // Check if trying to add yourself
    if (formattedName === player.name) {
      return "You cannot add yourself to your friends list."
    }

    // Check if already in friends list (case-insensitive)
    const existingFriend = player.friends.find(f => f.toLowerCase() === formattedName.toLowerCase())
    if (existingFriend) {
      return `${formattedName} is already in your friends list.`
    }

    // Check if the character exists
    if (!Player.characterExists(formattedName)) {
      return `Character ${formattedName} does not exist.`
    }

    // Add to friends list
    player.friends.push(formattedName)
    player.save()

    return `${formattedName} has been added to your friends list.`
  }

  friendsRemove(player, friendName) {
    // Initialize friends list if it doesn't exist
    if (!player.friends) {
      player.friends = []
    }

    if (player.friends.length === 0) {
      return "Your friends list is empty."
    }

    // Format name with proper case
    const formattedName = friendName.charAt(0).toUpperCase() + friendName.slice(1).toLowerCase()
    
    // Find friend in list (case-insensitive)
    const friendIndex = player.friends.findIndex(f => f.toLowerCase() === formattedName.toLowerCase())
    
    if (friendIndex === -1) {
      return `${formattedName} is not in your friends list.`
    }

    // Remove from friends list
    player.friends.splice(friendIndex, 1)
    player.save()

    return `${formattedName} has been removed from your friends list.`
  }

  friendsNote(player, friendName, noteMessage) {
    // Initialize friends list if it doesn't exist
    if (!player.friends) {
      player.friends = []
    }

    // Format name with proper case
    const formattedName = friendName.charAt(0).toUpperCase() + friendName.slice(1).toLowerCase()
    
    // Check if friend is in the list
    const friendExists = player.friends.find(f => f.toLowerCase() === formattedName.toLowerCase())
    if (!friendExists) {
      return `${formattedName} is not in your friends list. Add them first with 'friends add ${formattedName}'.`
    }

    // Clean and validate the note message
    const cleanedNote = this.cleanNoteMessage(noteMessage)
    
    // Initialize friendNotes if it doesn't exist
    if (!player.friendNotes) {
      player.friendNotes = {}
    }

    // Store the note (empty string will clear the note)
    if (cleanedNote.length === 0) {
      delete player.friendNotes[formattedName.toLowerCase()]
    } else {
      player.friendNotes[formattedName.toLowerCase()] = cleanedNote
    }
    player.save()

    if (cleanedNote.length === 0) {
      return `Note for ${formattedName} has been cleared.`
    } else {
      return `Note for ${formattedName} updated: "${cleanedNote}"`
    }
  }

  cleanNoteMessage(message) {
    // Allow only a-zA-Z0-9.,:;!?_ and spaces
    const allowedChars = /[a-zA-Z0-9.,:;!?_ ]/g
    const cleanedMessage = message.match(allowedChars)?.join('') || ''
    
    // Truncate to 50 characters
    return cleanedMessage.substring(0, 50).trim()
  }

  getFriendNote(player, friendName) {
    if (!player.friendNotes) {
      return null
    }
    
    const formattedName = friendName.charAt(0).toUpperCase() + friendName.slice(1).toLowerCase()
    return player.friendNotes[formattedName.toLowerCase()] || null
  }


}

export default FriendsCommands