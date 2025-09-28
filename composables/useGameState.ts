import { ref, readonly, nextTick } from 'vue'

// Types
export interface GameOutput {
  text: string
  type: 'normal' | 'error' | 'success' | 'warning' | 'input'
  timestamp: number
}

export const useGameState = () => {
  // Game output state
  const gameOutput = ref<GameOutput[]>([])
  const currentCommand = ref<string>('')
  const commandInput = ref<HTMLInputElement | null>(null)

  // Quick commands for mobile/ease of use
  const quickCommands = ['look', 'inventory', 'north', 'south', 'east', 'west', 'help']

  // Add output to game log
  const addGameOutput = (text: string, type: GameOutput['type'] = 'normal'): void => {
    gameOutput.value.push({ text, type, timestamp: Date.now() })
    
    // Limit output history
    if (gameOutput.value.length > 100) {
      gameOutput.value = gameOutput.value.slice(-80)
    }
    
    // Auto-scroll to bottom
    nextTick(() => {
      const outputArea = document.querySelector('.overflow-y-auto')
      if (outputArea) {
        outputArea.scrollTop = outputArea.scrollHeight
      }
    })
  }

  // Clear command input
  const clearCommand = (): void => {
    currentCommand.value = ''
  }

  // Focus command input
  const focusCommandInput = (): void => {
    commandInput.value?.focus()
  }

  return {
    // State
    gameOutput: readonly(gameOutput),
    currentCommand,
    commandInput,
    quickCommands,
    
    // Actions
    addGameOutput,
    clearCommand,
    focusCommandInput
  }
}