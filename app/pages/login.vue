<template>
  <div class="min-h-screen console flex items-center justify-center">
    <div class="w-full max-w-md">
      <!-- Game Title -->
      <div class="text-center mb-8">
        <h1 class="text-5xl font-bold text-terminal-bright uppercase mb-2">
          MUDDEN
        </h1>
        <p class="text-terminal-text">
          Multi-User Dungeon - Text Adventure Game
        </p>
      </div>

      <!-- Login Form -->
      <div class="border border-terminal-dim bg-terminal-bg p-6">
        <h2 class="text-2xl font-bold text-terminal-bright mb-6 text-center">
          LOGIN
        </h2>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- Email Field -->
          <div>
            <label class="block text-terminal-text text-sm font-bold mb-2">
              Email
            </label>
            <input
              v-model="loginForm.email"
              type="email"
              required
              class="w-full px-3 py-2 bg-terminal-bg border border-terminal-dim text-terminal-text placeholder-terminal-dim focus:outline-none focus:border-terminal-bright"
              placeholder="Enter your email address"
              :disabled="isLoading"
            />
          </div>

          <!-- Character Name Field (only for registration) -->
          <div v-if="isRegistering">
            <label class="block text-terminal-text text-sm font-bold mb-2">
              Character Name
            </label>
            <input
              v-model="loginForm.characterName"
              type="text"
              required
              class="w-full px-3 py-2 bg-terminal-bg border border-terminal-dim text-terminal-text placeholder-terminal-dim focus:outline-none focus:border-terminal-bright"
              placeholder="Choose your character name"
              :disabled="isLoading"
            />
          </div>

          <!-- Password Field -->
          <div>
            <label class="block text-terminal-text text-sm font-bold mb-2">
              Password
            </label>
            <input
              v-model="loginForm.password"
              type="password"
              required
              class="w-full px-3 py-2 bg-terminal-bg border border-terminal-dim text-terminal-text placeholder-terminal-dim focus:outline-none focus:border-terminal-bright"
              :placeholder="isRegistering ? 'Create a password (min 6 characters)' : 'Enter your password'"
              :disabled="isLoading"
            />
          </div>

          <!-- Error Message -->
          <div v-if="errorMessage" class="text-terminal-red text-sm">
            {{ errorMessage }}
          </div>

          <!-- Success Message -->
          <div v-if="successMessage" class="text-terminal-yellow text-sm">
            {{ successMessage }}
          </div>

          <!-- Login/Register Button -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-2 px-4 border border-terminal-dim bg-terminal-bg text-terminal-bright hover:bg-terminal-dim hover:text-terminal-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {{ isLoading ? (isRegistering ? 'CREATING ACCOUNT...' : 'LOGGING IN...') : (isRegistering ? 'REGISTER' : 'LOGIN') }}
          </button>

          <!-- Toggle between Login and Register -->
          <div class="text-center">
            <button
              type="button"
              @click="toggleMode"
              :disabled="isLoading"
              class="text-terminal-accent hover:text-terminal-bright underline text-sm"
            >
              {{ isRegistering ? 'Already have an account? Login' : 'Need an account? Register' }}
            </button>
          </div>
        </form>

        <!-- Development Section -->
        
      </div>

      <!-- Game Info -->
      <div class="mt-6 text-center text-terminal-dim text-xs">
        <p>A retro text-based adventure game</p>
        <p>Built with Nuxt 3 & Supabase</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Set page meta
definePageMeta({
  layout: false, // Don't use default layout
  auth: false    // Don't require auth for this page
})

// Reactive data
const isRegistering = ref(false)
const loginForm = ref({
  email: '',
  password: '',
  characterName: ''
})

const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Toggle between login and register mode
function toggleMode() {
  isRegistering.value = !isRegistering.value
  errorMessage.value = ''
  successMessage.value = ''
}

// Handle login or registration
async function handleLogin() {
  if (isRegistering.value) {
    await handleRegister()
    return
  }
  
  if (!loginForm.value.email || !loginForm.value.password) {
    errorMessage.value = 'Please enter both email and password'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await $fetch<{ success: boolean; message: string; player: any }>('/api/auth/login', {
      method: 'POST',
      body: {
        email: loginForm.value.email,
        password: loginForm.value.password
      }
    })

    successMessage.value = `Welcome back, ${response.player.characterName}!`
    
    // Redirect to game after short delay
    setTimeout(() => {
      navigateTo('/')
    }, 1000)

  } catch (error) {
    console.error('Login error:', error)
    errorMessage.value = (error as any)?.data?.message || 'Login failed. Please try again.'
  } finally {
    isLoading.value = false
  }
}

// Handle registration
async function handleRegister() {
  if (!loginForm.value.email || !loginForm.value.password || !loginForm.value.characterName) {
    errorMessage.value = 'Please fill in all fields'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: loginForm.value.email,
        password: loginForm.value.password,
        characterName: loginForm.value.characterName
      }
    })

    successMessage.value = 'Registration successful! Please check your email to verify your account.'
    
    // Clear form
    loginForm.value.email = ''
    loginForm.value.password = ''
    loginForm.value.characterName = ''
    
    // Switch back to login mode
    isRegistering.value = false

  } catch (error) {
    console.error('Register error:', error)
    errorMessage.value = (error as any)?.data?.message || 'Registration failed. Please try again.'
  } finally {
    isLoading.value = false
  }
}

// Quick login for development
async function quickLogin(email: string) {
  loginForm.value.email = email
  loginForm.value.password = 'dev-password'
  await handleLogin()
}



// Auto-focus username field
onMounted(() => {
  nextTick(() => {
    const usernameInput = document.querySelector('input[type="text"]')
    if (usernameInput) {
      (usernameInput as HTMLInputElement).focus()
    }
  })
})
</script>