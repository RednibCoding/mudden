<template>
  <div class="min-h-screen console flex items-center justify-center">
    <div class="w-full max-w-md">
      <!-- Game Title -->
      <div class="text-center mb-8">
        <h1 class="text-5xl font-bold text-terminal-bright uppercase mb-2">
          MUDDEN
        </h1>
        <p class="text-terminal-text">
          Email Verification
        </p>
      </div>

      <!-- Verification Status -->
      <div class="border border-terminal-dim bg-terminal-bg p-6">
        <!-- Loading State -->
        <div v-if="isLoading" class="text-center">
          <p class="text-terminal-text mb-4">Verifying your email...</p>
          <div class="text-terminal-accent">⚡ PROCESSING ⚡</div>
        </div>

        <!-- Success State -->
        <div v-else-if="verified" class="text-center">
          <div class="text-terminal-success text-2xl mb-4">✅</div>
          <h2 class="text-terminal-bright text-xl mb-4">Email Verified!</h2>
          <p class="text-terminal-text mb-6">
            Welcome to MUDDEN, {{ playerName }}! Your account is now active.
          </p>
          <button
            @click="goToLogin"
            class="w-full bg-terminal-accent hover:bg-terminal-bright text-terminal-bg font-bold py-2 px-4 border border-terminal-accent hover:border-terminal-bright transition-colors"
          >
            Continue to Login
          </button>
        </div>

        <!-- Error State -->
        <div v-else class="text-center">
          <div class="text-terminal-error text-2xl mb-4">❌</div>
          <h2 class="text-terminal-bright text-xl mb-4">Verification Failed</h2>
          <p class="text-terminal-text mb-6">
            {{ errorMessage }}
          </p>
          <button
            @click="goToLogin"
            class="w-full bg-terminal-dim hover:bg-terminal-text text-terminal-text hover:text-terminal-bg font-bold py-2 px-4 border border-terminal-dim hover:border-terminal-text transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>

      <!-- Game Info -->
      <div class="mt-6 text-center text-terminal-dim text-xs">
        <p>A retro text-based adventure game</p>
        <p>Built with Nuxt 3 & Supabase</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// Set page meta
definePageMeta({
  layout: false,
  auth: false
})

// Reactive data
const isLoading = ref(true)
const verified = ref(false)
const errorMessage = ref('')
const playerName = ref('')

// Get token from URL
const route = useRoute()
const token = route.query.token

// Verify email on mount
onMounted(async () => {
  if (!token) {
    errorMessage.value = 'No verification token provided'
    isLoading.value = false
    return
  }

  try {
    const response = await $fetch('/api/auth/verify-email', {
      method: 'GET',
      query: { token }
    })

    if (response.success) {
      verified.value = true
      playerName.value = response.player.characterName
    } else {
      errorMessage.value = response.message || 'Verification failed'
    }
  } catch (error) {
    console.error('Verification error:', error)
    errorMessage.value = error?.data?.message || 'Invalid or expired verification link'
  } finally {
    isLoading.value = false
  }
})

// Navigate to login
function goToLogin() {
  navigateTo('/login')
}
</script>