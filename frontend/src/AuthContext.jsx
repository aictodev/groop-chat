/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

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

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)

            if (event === 'SIGNED_IN') {
                console.log('User signed in:', session?.user?.email)
            } else if (event === 'SIGNED_OUT') {
                console.log('User signed out')
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const signInWithGoogle = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`
                }
            })
            if (error) throw error
        } catch (error) {
            console.error('Error signing in with Google:', error.message)
            throw error
        }
    }

    const signInWithEmail = async (email, password) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            })
            if (error) throw error
        } catch (error) {
            console.error('Error signing in with email:', error.message)
            throw error
        }
    }

    const signUp = async (email, password) => {
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password
            })
            if (error) throw error
        } catch (error) {
            console.error('Error signing up:', error.message)
            throw error
        }
    }

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
        } catch (error) {
            console.error('Error signing out:', error.message)
            throw error
        }
    }

    const value = {
        user,
        session,
        loading,
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
