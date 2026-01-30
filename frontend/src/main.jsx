import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './whatsapp.css'
import App from './App.jsx'
import { AuthProvider } from './AuthContext'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexReactClient } from 'convex/react'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConvexAuthProvider>
  </StrictMode>,
)
