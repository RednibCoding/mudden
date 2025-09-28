<script setup lang="ts">
import { useGame } from '../../composables/useGame'

// Initialize game composable
const game = useGame()

// Destructure for template usage
const {
  // Game state
  gameOutput,
  currentCommand,
  commandInput,
  quickCommands,
  
  // Player state
  player,
  playerPosition,
  
  // Room state
  currentRoom,
  currentAreaData,
  areaGrid,
  getRoomTitle,
  
  // Actions
  executeCommand,
  quickCommand,
  initializeGame
} = game

// Game initialization
onMounted(async () => {
  await initializeGame()
})
</script>

<template>
  <div class="h-screen console flex flex-col overflow-hidden">
    <!-- Game Title -->
    <div class="flex items-center justify-between py-2 px-4 border-b border-terminal-dim mb-4 flex-shrink-0">
      <h1 class="text-3xl font-bold text-terminal-bright uppercase">
        MUDDEN
      </h1>
      <p class="text-sm text-terminal-text">
        Multi-User Dungeon - Text Adventure Game
      </p>
    </div>

    <!-- Game Output Area and Mini Map -->
    <div class="flex-1 flex gap-4 mb-4 mx-4 min-h-0">
      <!-- Console Output (3/4) -->
      <div class="w-3/4 overflow-y-auto p-3 border border-terminal-dim bg-terminal-bg">
        <div 
          v-for="(output, index) in gameOutput" 
          :key="index"
          class="console-output"
          :class="{
            'console-error': output.type === 'error',
            'console-success': output.type === 'success',
            'console-warning': output.type === 'warning',
            'console-input': output.type === 'input'
          }"
        >
          {{ output.text }}
        </div>
        <div v-if="gameOutput.length === 0" class="text-terminal-dim">
          Welcome to Mudden! Type 'help' to get started, or 'look' to examine your surroundings.
        </div>
      </div>
      
      <!-- Mini Map (1/4) -->
      <div class="w-1/4 border border-terminal-dim bg-terminal-bg p-3">
        <div class="text-terminal-bright text-sm font-bold mb-3 text-center">AREA MAP</div>
        
        <!-- Area Info -->
        <div class="mb-3 text-xs">
          <div class="text-terminal-text">Area: {{ currentAreaData?.name || 'Unknown' }}</div>
          <div class="text-terminal-bright">{{ currentRoom?.title || 'Unknown' }}</div>
          <div class="text-terminal-text mt-1">Pos: {{ playerPosition.x }},{{ playerPosition.y }}</div>
          <div class="text-terminal-yellow mt-1">
            <div v-if="currentRoom?.exits && Object.keys(currentRoom.exits).length > 0">
              <div>Exits:</div>
              <div v-for="(roomId, direction) in currentRoom.exits" :key="direction" class="ml-2">
                - {{ direction }}: {{ getRoomTitle(roomId) }}
              </div>
            </div>
            <div v-else>
              No exits
            </div>
          </div>
        </div>

        <!-- Dynamic grid representing the current area -->
        <div class="grid gap-1 justify-center mx-auto" :style="{ gridTemplateColumns: `repeat(${currentAreaData?.gridSize?.width || 10}, minmax(0, 1fr))`, width: 'fit-content' }">
          <div 
            v-for="(cell, index) in areaGrid" 
            :key="index"
            class="w-5 h-5 flex items-center justify-center"
            :class="{
              'border border-terminal-bright text-terminal-bright': cell.isPlayer,
              'border border-terminal-dim text-terminal-text': !cell.isPlayer && cell.hasRoom && cell.isAccessible,
              'border border-terminal-dim opacity-30 text-terminal-dim': !cell.isPlayer && cell.hasRoom && !cell.isAccessible,
              'border border-terminal-dim opacity-20': !cell.isPlayer && !cell.hasRoom
            }"
          >
            <span class="text-xs font-mono">{{ cell.isPlayer ? '●' : (cell.hasRoom && cell.isAccessible ? '·' : '') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Player Stats -->
    <div class="grid grid-cols-4 gap-4 mb-4 mx-4 p-2 border border-terminal-dim bg-terminal-bg flex-shrink-0">
      <div class="text-center">
        <div class="text-terminal-dim text-sm">Health</div>
        <div class="text-terminal-text">{{ player.health }}/{{ player.maxHealth }}</div>
      </div>
      <div class="text-center">
        <div class="text-terminal-dim text-sm">Level</div>
        <div class="text-terminal-text">{{ player.level }}</div>
      </div>
      <div class="text-center">
        <div class="text-terminal-dim text-sm">Gold</div>
        <div class="text-terminal-yellow">{{ player.gold }}</div>
      </div>
      <div class="text-center">
        <div class="text-terminal-dim text-sm">Location</div>
        <div class="text-terminal-text">{{ currentRoom?.title || 'Unknown' }}</div>
      </div>
    </div>

    <!-- Command Input -->
    <div class="flex items-center mx-4 border border-terminal-dim p-2 bg-terminal-bg flex-shrink-0">
      <span class="text-terminal-bright mr-2">&gt;</span>
      <input
        v-model="currentCommand"
        @keyup.enter="executeCommand()"
        class="flex-1 bg-transparent text-terminal-text placeholder-terminal-dim outline-none"
        placeholder="Enter a command..."
        autocomplete="off"
        ref="commandInput"
      />
    </div>

    <!-- Quick Commands -->
    <div class="mt-4 mx-4 mb-4 flex flex-wrap gap-2 flex-shrink-0">
      <button
        v-for="cmd in quickCommands"
        :key="cmd"
        @click="quickCommand(cmd)"
        class="px-2 py-1 border border-terminal-dim text-terminal-text bg-terminal-bg hover:bg-terminal-dim hover:text-terminal-bg transition-colors"
      >
        {{ cmd }}
      </button>
    </div>
  </div>
</template>