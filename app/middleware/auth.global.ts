export default defineNuxtRouteMiddleware(async (to) => {
  // Skip auth check for login page and other auth-free pages
  if (to.path === '/login' || to.meta.auth === false) {
    return
  }

  // Check if user has valid session
  try {
    const response = await $fetch<{ success: boolean; data?: any }>('/api/auth/me')
    
    if (!response.success || !response.data) {
      // No valid session, redirect to login
      return navigateTo('/login')
    }
    
    // User is authenticated, continue
    return
    
  } catch (error) {
    // No valid session or error, redirect to login
    return navigateTo('/login')
  }
})