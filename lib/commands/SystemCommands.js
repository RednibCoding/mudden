import BaseCommand from './BaseCommand.js'

class SystemCommands extends BaseCommand {
  getCommands() {
    return {
      // System
      'save': this.save.bind(this),
      'quit': this.quit.bind(this),
      'logout': this.logout.bind(this),
      'exit': this.quit.bind(this),
      'password': this.password.bind(this)
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
}

export default SystemCommands