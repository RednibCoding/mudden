import type { EventHandlerRequest, H3Event } from 'h3'
import { getCookie, setCookie, deleteCookie } from 'h3'
import jwt from 'jsonwebtoken'

// Session interface
interface UserSession {
  playerId: string
  characterName: string
  issuedAt: number
  expiresAt: number
}

// JWT secret (in production, use a secure secret from environment)
const JWT_SECRET = process.env.JWT_SECRET || 'mudden-dev-secret-change-in-production'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

/**
 * SessionService - Simple JWT-based session management
 * Handles user authentication and authorization
 */
export class SessionService {
  
  // Create a new session token
  static createSession(playerId: string, characterName: string): string {
    const now = Date.now()
    const session: UserSession = {
      playerId,
      characterName,
      issuedAt: now,
      expiresAt: now + SESSION_DURATION
    }
    
    return jwt.sign(session, JWT_SECRET)
  }
  
  // Verify and decode session token
  static verifySession(token: string): UserSession | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as UserSession
      
      // Check if session is expired
      if (Date.now() > decoded.expiresAt) {
        return null
      }
      
      return decoded
    } catch (error) {
      return null
    }
  }
  
  // Get session from HTTP request
  static async getUserSession(event: H3Event<EventHandlerRequest>): Promise<UserSession | null> {
    const sessionToken = getCookie(event, 'session-token') || getHeader(event, 'authorization')?.replace('Bearer ', '')
    
    if (!sessionToken) {
      return null
    }
    
    return this.verifySession(sessionToken)
  }
  
  // Set session cookie
  static setSessionCookie(event: H3Event<EventHandlerRequest>, token: string): void {
    setCookie(event, 'session-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_DURATION / 1000 // Convert to seconds
    })
  }
  
  // Clear session cookie
  static clearSessionCookie(event: H3Event<EventHandlerRequest>): void {
    deleteCookie(event, 'session-token')
  }
  
  // Middleware helper to require authentication
  static async requireAuth(event: H3Event<EventHandlerRequest>): Promise<UserSession> {
    const session = await this.getUserSession(event)
    
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }
    
    return session
  }
  
  // Middleware helper to require specific player authorization
  static async requirePlayerAuth(event: H3Event<EventHandlerRequest>, requiredPlayerId: string): Promise<UserSession> {
    const session = await this.requireAuth(event)
    
    if (session.playerId !== requiredPlayerId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied - you can only access your own data'
      })
    }
    
    return session
  }
  
  // Check if session is valid without throwing errors
  static async isAuthenticated(event: H3Event<EventHandlerRequest>): Promise<boolean> {
    const session = await this.getUserSession(event)
    return session !== null
  }
  
  // Refresh session (extend expiration)
  static refreshSession(session: UserSession): string {
    const now = Date.now()
    const refreshedSession: UserSession = {
      ...session,
      expiresAt: now + SESSION_DURATION
    }
    
    return jwt.sign(refreshedSession, JWT_SECRET)
  }
}

export default SessionService