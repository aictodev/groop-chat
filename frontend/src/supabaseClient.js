import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rrdlkjmysynyepfxxhrg.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZGxram15c3lueWVwZnh4aHJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2Njc1NjksImV4cCI6MjA3MjI0MzU2OX0.glTD2iMEpSfqKapNRuWfF6F4E07jHl33VqMP7oXVDIE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
