const { createClient } = require('@supabase/supabase-js');
const database = require('./database');

// Initialize Supabase client for server-side auth verification
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Missing Supabase credentials for auth middleware. Authentication will fail.');
    // process.exit(1); // Do not exit, allow server to start
} else {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
    } catch (e) {
        console.error('Failed to initialize Supabase auth client:', e);
    }
}

// Middleware to verify JWT token from Supabase
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.split(' ')[1];

        if (!supabase) {
            console.error('Supabase client not initialized');
            return res.status(500).json({ error: 'Authentication service unavailable' });
        }

        // Verify the JWT token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Ensure user exists in our custom users table
        try {
            await database.ensureUserExists(user, token);
        } catch (dbError) {
            console.error('Failed to ensure user exists:', dbError);
            // Continue anyway - this shouldn't block authentication
        }

        // Add user to request object for use in route handlers
        req.user = user;
        req.authToken = token;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

// Optional auth middleware - allows unauthenticated requests but adds user if token is present
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (supabase) {
                const { data: { user }, error } = await supabase.auth.getUser(token);

                if (!error && user) {
                    // Ensure user exists in our custom users table
                    try {
                        await database.ensureUserExists(user, token);
                    } catch (dbError) {
                        console.error('Failed to ensure user exists (optional auth):', dbError);
                        // Continue anyway - this shouldn't block optional authentication
                    }
                    req.user = user;
                    req.authToken = token;
                }
            }
        }

        next();
    } catch (error) {
        // Don't fail on auth errors for optional auth
        next();
    }
};

module.exports = {
    authenticateUser,
    optionalAuth,
    supabase
};
