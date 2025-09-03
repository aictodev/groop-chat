require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('🚀 Starting DeepSeek model migration...');
    
    try {
        // Step 1: Update ai_models table
        console.log('1. Updating ai_models table...');
        const { error: updateError } = await supabase
            .from('ai_models')
            .update({
                id: 'deepseek/deepseek-chat',
                name: 'DeepSeek Chat',
                display_name: 'DeepSeek Chat V3.1'
            })
            .eq('id', 'deepseek/deepseek-v2-coder');
        
        if (updateError && updateError.code !== 'PGRST116') { // PGRST116 = no rows to update
            console.error('Error updating ai_models:', updateError);
        } else {
            console.log('✅ ai_models table updated');
        }

        // Step 2: Check if old model exists, if not insert new one
        console.log('2. Checking for existing model...');
        const { data: existingModel } = await supabase
            .from('ai_models')
            .select('id')
            .eq('id', 'deepseek/deepseek-chat')
            .single();

        if (!existingModel) {
            console.log('3. Inserting new DeepSeek Chat model...');
            const { error: insertError } = await supabase
                .from('ai_models')
                .insert({
                    id: 'deepseek/deepseek-chat',
                    name: 'DeepSeek Chat',
                    display_name: 'DeepSeek Chat V3.1',
                    avatar: ' D ',
                    provider: 'deepseek',
                    is_active: true
                });
            
            if (insertError) {
                console.error('Error inserting new model:', insertError);
            } else {
                console.log('✅ New DeepSeek Chat model inserted');
            }
        }

        // Step 3: Update messages table
        console.log('4. Updating messages table...');
        const { error: messagesError } = await supabase
            .from('messages')
            .update({ ai_model_id: 'deepseek/deepseek-chat' })
            .eq('ai_model_id', 'deepseek/deepseek-v2-coder');
        
        if (messagesError && messagesError.code !== 'PGRST116') {
            console.error('Error updating messages:', messagesError);
        } else {
            console.log('✅ Messages table updated');
        }

        // Step 4: Update conversation_ai_models table
        console.log('5. Updating conversation_ai_models table...');
        const { error: conversationError } = await supabase
            .from('conversation_ai_models')
            .update({ ai_model_id: 'deepseek/deepseek-chat' })
            .eq('ai_model_id', 'deepseek/deepseek-v2-coder');
        
        if (conversationError && conversationError.code !== 'PGRST116') {
            console.error('Error updating conversation_ai_models:', conversationError);
        } else {
            console.log('✅ conversation_ai_models table updated');
        }

        // Step 5: Ensure new model is in default conversation
        console.log('6. Adding new model to default conversation...');
        const { error: addToConversationError } = await supabase
            .from('conversation_ai_models')
            .upsert({
                conversation_id: '00000000-0000-0000-0000-000000000002',
                ai_model_id: 'deepseek/deepseek-chat',
                is_active: true
            });
        
        if (addToConversationError) {
            console.error('Error adding model to conversation:', addToConversationError);
        } else {
            console.log('✅ Model added to default conversation');
        }

        console.log('\n🎉 Migration completed successfully!');
        console.log('DeepSeek V2 Coder → DeepSeek Chat V3.1');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
runMigration();