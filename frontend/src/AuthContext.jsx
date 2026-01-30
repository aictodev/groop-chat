/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuthActions, useAuthToken } from '@convex-dev/auth/react'
import { useConvexAuth } from 'convex/react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:7001'

const AuthContext = createContext({})

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)
    const { isAuthenticated, isLoading } = useConvexAuth()
    const { signIn, signOut: authSignOut } = useAuthActions()
    const token = useAuthToken()

    useEffect(() => {
        if (!token) {
            setSession(null)
            setUser(null)
            setLoading(isLoading)
            return
        }

        let ignore = false
        const controller = new AbortController()

        const loadProfile = async () => {
            setSession({ access_token: token })
            setLoading(true)

            try {
                const response = await fetch(`${BACKEND_URL}/api/profile`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal
                })

                if (!response.ok) {
                    throw new Error(`Profile load failed (${response.status})`)
                }

                const data = await response.json()
                if (!ignore) {
                    setUser(data)
                }
            } catch (error) {
                if (!ignore && error.name !== 'AbortError') {
                    console.error('Error loading profile:', error.message)
                    setUser(null)
                }
            } finally {
                if (!ignore) {
                    setLoading(false)
                }
            }
        }

        loadProfile()

        return () => {
            ignore = true
            controller.abort()
        }
    }, [token, isLoading])

    const signInWithGoogle = async () => {
        try {
            await signIn('google', { redirectTo: window.location.origin })
        } catch (error) {
            console.error('Error signing in with Google:', error.message)
            throw error
        }
    }

    const signInWithEmail = async (email, password) => {
        try {
            await signIn('password', { flow: 'signIn', email, password })
        } catch (error) {
            console.error('Error signing in with email:', error.message)
            throw error
        }
    }

    const signUp = async (email, password) => {
        try {
            await signIn('password', { flow: 'signUp', email, password })
        } catch (error) {
            console.error('Error signing up:', error.message)
            throw error
        }
    }

    const signOut = async () => {
        try {
            await authSignOut()
            setUser(null)
            setSession(null)
        } catch (error) {
            console.error('Error signing out:', error.message)
            throw error
        }
    }

    const value = {
        user,
        session,
        loading: loading || isLoading || (isAuthenticated && !user),
        signInWithGoogle,
        signInWithEmail,
        signUp,
        signOut
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
