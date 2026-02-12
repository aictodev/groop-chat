const path = require('path');
const { ConvexHttpClient } = require('convex/browser');
const database = require('./database');

const convexUrl = process.env.CONVEX_URL;
let api = null;

try {
    const apiPath = path.join(__dirname, '..', 'convex', '_generated', 'api_cjs.cjs');
    try {
        api = require(apiPath).api;
    } catch (error) {
        const { anyApi } = require('convex/server');
        api = anyApi;
        console.warn('Convex API bindings not found for auth, falling back to anyApi:', error?.message || error);
    }
} catch (error) {
    console.error('Failed to load Convex API bindings for auth:', error);
}

const createAuthedClient = (token) => {
    if (!convexUrl) {
        return null;
    }
    const client = new ConvexHttpClient(convexUrl);
    client.setAuth(token);
    return client;
};

const resolveUserProfile = async (client) => {
    let profile = null;
    try {
        profile = await client.query(api.db.getAuthedUserProfile, {});
    } catch (error) {
        console.warn('Unable to fetch authed profile via query, falling back to ensureUserProfile:', error?.message || error);
    }

    if (profile?.id) {
        return profile;
    }

    return await client.mutation(api.db.ensureUserProfile, {});
};

const buildUser = (profile) => ({
    id: profile.id || profile._id,
    email: profile.email || null,
    user_metadata: {
        full_name: profile.display_name || null,
        avatar_url: profile.avatar_url || null
    },
    auth_user_id: profile.auth_user_id || profile._id || null
});

const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.split(' ')[1];

        if (!api || !convexUrl) {
            console.error('Convex auth not configured');
            return res.status(500).json({ error: 'Authentication service unavailable' });
        }

        const client = createAuthedClient(token);
        if (!client) {
            return res.status(500).json({ error: 'Authentication service unavailable' });
        }

        const profile = await resolveUserProfile(client);
        if (!profile) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        try {
            await database.ensureDefaultConversation(profile.id);
        } catch (dbError) {
            console.warn('Failed to ensure default conversation:', dbError?.message || dbError);
        }

        req.user = buildUser(profile);
        req.authToken = token;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (api && convexUrl) {
                try {
                    const client = createAuthedClient(token);
                    const profile = await resolveUserProfile(client);
                    if (profile) {
                        req.user = buildUser(profile);
                        req.authToken = token;
                    }
                } catch (error) {
                    console.warn('Optional auth failed:', error?.message || error);
                }
            }
        }

        next();
    } catch (error) {
        next();
    }
};

module.exports = {
    authenticateUser,
    optionalAuth
};
