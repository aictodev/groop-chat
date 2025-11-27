require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStorage() {
    const bucket = process.env.SUPABASE_AVATAR_BUCKET || 'avatars';
    console.log(`Checking bucket: ${bucket}`);

    // List files in the 'profiles' folder (recursively if possible, but list returns folders too)
    // We might need to iterate if there are many users, but for now let's try listing the root of profiles

    // First, list folders in 'profiles'
    const { data: folders, error: folderError } = await supabase.storage
        .from(bucket)
        .list('profiles', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    if (folderError) {
        console.error('Error listing profiles folder:', folderError);
        return;
    }

    console.log(`Found ${folders.length} user folders in 'profiles'. Checking recent ones...`);

    for (const folder of folders) {
        // folder.name is the userId
        const userId = folder.name;

        // List files in this user's folder
        const { data: files, error: fileError } = await supabase.storage
            .from(bucket)
            .list(`profiles/${userId}`, { limit: 10, sortBy: { column: 'created_at', order: 'desc' } });

        if (fileError) {
            console.error(`Error listing files for user ${userId}:`, fileError);
            continue;
        }

        if (files && files.length > 0) {
            console.log(`\nUser: ${userId}`);
            files.forEach(file => {
                console.log(`  - ${file.name} (${(file.metadata?.size / 1024).toFixed(2)} KB) - ${new Date(file.created_at).toLocaleString()}`);
            });
        }
    }
}

checkStorage().catch(console.error);
