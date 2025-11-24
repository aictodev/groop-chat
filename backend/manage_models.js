#!/usr/bin/env node
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define available models and their details
const AVAILABLE_MODELS = {
    // Google Models
    'google/gemini-2.5-flash': { name: 'Gemini', display_name: 'Gemini 2.5 Flash', avatar: ' G ', provider: 'google' },
    'google/gemini-flash-1.5': { name: 'Gemini', display_name: 'Gemini 1.5 Flash', avatar: ' G ', provider: 'google' },
    'google/gemini-flash-2.0': { name: 'Gemini', display_name: 'Gemini 2.0 Flash', avatar: ' G ', provider: 'google' },

    // OpenAI Models
    'openai/gpt-4o-mini': { name: 'GPT-4o mini', display_name: 'GPT-4o Mini', avatar: ' O ', provider: 'openai' },
    'openai/gpt-4o': { name: 'GPT-4o', display_name: 'GPT-4o', avatar: ' O ', provider: 'openai' },
    'openai/gpt-3.5-turbo': { name: 'GPT-3.5', display_name: 'GPT-3.5 Turbo', avatar: ' O ', provider: 'openai' },

    // Anthropic Models
    'anthropic/claude-3.5-sonnet': { name: 'Claude', display_name: 'Claude 3.5 Sonnet', avatar: ' A ', provider: 'anthropic' },
    'anthropic/claude-3-haiku': { name: 'Claude', display_name: 'Claude 3 Haiku', avatar: ' A ', provider: 'anthropic' },

    // Meta Models
    'meta-llama/llama-3-8b-instruct': { name: 'Llama', display_name: 'Llama 3 8B Instruct', avatar: ' L ', provider: 'meta' },
    'meta-llama/llama-3-70b-instruct': { name: 'Llama', display_name: 'Llama 3 70B Instruct', avatar: ' L ', provider: 'meta' },

    // DeepSeek Models
    'deepseek/deepseek-chat': { name: 'DeepSeek Chat', display_name: 'DeepSeek Chat', avatar: ' D ', provider: 'deepseek' },
    'deepseek/deepseek-coder': { name: 'DeepSeek Coder', display_name: 'DeepSeek Coder', avatar: ' D ', provider: 'deepseek' },

    // Qwen Models
    'qwen/qwen-2.5-7b-instruct': { name: 'Qwen', display_name: 'Qwen 2.5 7B Instruct', avatar: ' Q ', provider: 'qwen' },
    'qwen/qwen3-8b:free': { name: 'Qwen', display_name: 'Qwen 3 8B Free', avatar: ' Q ', provider: 'qwen' },
    'qwen/qwen-2-7b-instruct': { name: 'Qwen', display_name: 'Qwen 2 7B Instruct', avatar: ' Q ', provider: 'qwen' },

    // xAI Models
    'x-ai/grok-4.1-fast:free': { name: 'Grok', display_name: 'Grok 4.1 Fast', avatar: ' X ', provider: 'x-ai' },
};

async function listCurrentModels() {
    console.log('📋 Current models in database:');
    const { data, error } = await supabase
        .from('ai_models')
        .select('*')
        .order('provider', { ascending: true });

    if (error) {
        console.error('Error fetching models:', error);
        return;
    }

    data.forEach((model, index) => {
        console.log(`${index + 1}. ${model.id} (${model.display_name}) - ${model.is_active ? '✅ Active' : '❌ Inactive'}`);
    });
    console.log('');
}

async function addModel(modelId) {
    const modelInfo = AVAILABLE_MODELS[modelId];
    if (!modelInfo) {
        console.error(`❌ Model ${modelId} not found in available models list`);
        console.log('Available models:');
        Object.keys(AVAILABLE_MODELS).forEach(id => {
            console.log(`  - ${id}`);
        });
        return false;
    }

    console.log(`➕ Adding model: ${modelId}`);
    const { error } = await supabase
        .from('ai_models')
        .upsert({
            id: modelId,
            name: modelInfo.name,
            display_name: modelInfo.display_name,
            avatar: modelInfo.avatar,
            provider: modelInfo.provider,
            is_active: true
        }, { onConflict: 'id' });

    if (error) {
        console.error('Error adding model:', error);
        return false;
    }

    console.log(`✅ Successfully added ${modelInfo.display_name}`);
    return true;
}

async function replaceModel(oldModelId, newModelId) {
    const newModelInfo = AVAILABLE_MODELS[newModelId];
    if (!newModelInfo) {
        console.error(`❌ New model ${newModelId} not found in available models list`);
        return false;
    }

    console.log(`🔄 Replacing ${oldModelId} with ${newModelId}`);

    try {
        // Step 1: Add new model
        const addSuccess = await addModel(newModelId);
        if (!addSuccess) return false;

        // Step 2: Update messages table
        console.log('📝 Updating message references...');
        const { error: msgError } = await supabase
            .from('messages')
            .update({ ai_model_id: newModelId })
            .eq('ai_model_id', oldModelId);

        if (msgError && msgError.code !== 'PGRST116') {
            console.error('Error updating messages:', msgError);
        } else {
            console.log('✅ Updated message references');
        }

        // Step 3: Update conversation_ai_models table
        console.log('🔗 Updating conversation AI model references...');
        const { error: convError } = await supabase
            .from('conversation_ai_models')
            .update({ ai_model_id: newModelId })
            .eq('ai_model_id', oldModelId);

        if (convError && convError.code !== 'PGRST116') {
            console.error('Error updating conversation models:', convError);
        } else {
            console.log('✅ Updated conversation AI model references');
        }

        // Step 4: Remove old model
        console.log('🗑️ Removing old model...');
        const { error: deleteError } = await supabase
            .from('ai_models')
            .delete()
            .eq('id', oldModelId);

        if (deleteError) {
            console.log(`⚠️ Could not delete old model ${oldModelId}:`, deleteError.message);
        } else {
            console.log(`✅ Removed old model ${oldModelId}`);
        }

        console.log(`\n🎉 Successfully replaced ${oldModelId} with ${newModelId}!`);
        console.log('💡 Remember to update your backend code and restart the server!');
        return true;

    } catch (error) {
        console.error('❌ Replace operation failed:', error);
        return false;
    }
}

async function removeModel(modelId) {
    console.log(`🗑️ Removing model: ${modelId}`);

    // First check if model is referenced anywhere
    const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .eq('ai_model_id', modelId)
        .limit(1);

    const { data: conversations } = await supabase
        .from('conversation_ai_models')
        .select('id')
        .eq('ai_model_id', modelId)
        .limit(1);

    if (messages && messages.length > 0) {
        console.log('⚠️ Model is referenced in messages. Use replace instead of remove.');
        return false;
    }

    if (conversations && conversations.length > 0) {
        console.log('⚠️ Model is referenced in conversations. Use replace instead of remove.');
        return false;
    }

    const { error } = await supabase
        .from('ai_models')
        .delete()
        .eq('id', modelId);

    if (error) {
        console.error('Error removing model:', error);
        return false;
    }

    console.log(`✅ Successfully removed ${modelId}`);
    return true;
}

async function toggleModel(modelId) {
    console.log(`🔄 Toggling active status for: ${modelId}`);

    const { data: current, error: fetchError } = await supabase
        .from('ai_models')
        .select('is_active')
        .eq('id', modelId)
        .single();

    if (fetchError) {
        console.error('Error fetching model:', fetchError);
        return false;
    }

    const newStatus = !current.is_active;
    const { error: updateError } = await supabase
        .from('ai_models')
        .update({ is_active: newStatus })
        .eq('id', modelId);

    if (updateError) {
        console.error('Error toggling model:', updateError);
        return false;
    }

    console.log(`✅ Model ${modelId} is now ${newStatus ? 'active' : 'inactive'}`);
    return true;
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log('🤖 AI Model Management Tool\n');

    switch (command) {
        case 'list':
            await listCurrentModels();
            break;

        case 'add':
            if (!args[1]) {
                console.error('❌ Please provide a model ID to add');
                console.log('Usage: node manage_models.js add <model_id>');
                process.exit(1);
            }
            await addModel(args[1]);
            break;

        case 'replace':
            if (!args[1] || !args[2]) {
                console.error('❌ Please provide both old and new model IDs');
                console.log('Usage: node manage_models.js replace <old_model_id> <new_model_id>');
                process.exit(1);
            }
            await replaceModel(args[1], args[2]);
            break;

        case 'remove':
            if (!args[1]) {
                console.error('❌ Please provide a model ID to remove');
                console.log('Usage: node manage_models.js remove <model_id>');
                process.exit(1);
            }
            await removeModel(args[1]);
            break;

        case 'toggle':
            if (!args[1]) {
                console.error('❌ Please provide a model ID to toggle');
                console.log('Usage: node manage_models.js toggle <model_id>');
                process.exit(1);
            }
            await toggleModel(args[1]);
            break;

        case 'available':
            console.log('📚 Available models:');
            Object.entries(AVAILABLE_MODELS).forEach(([id, info]) => {
                console.log(`  ${id}`);
                console.log(`    Name: ${info.display_name}`);
                console.log(`    Provider: ${info.provider}`);
                console.log('');
            });
            break;

        default:
            console.log('Usage:');
            console.log('  node manage_models.js list                    # List current models');
            console.log('  node manage_models.js available               # List available models');
            console.log('  node manage_models.js add <model_id>          # Add a new model');
            console.log('  node manage_models.js replace <old> <new>     # Replace a model');
            console.log('  node manage_models.js remove <model_id>       # Remove a model');
            console.log('  node manage_models.js toggle <model_id>       # Toggle active status');
            console.log('');
            console.log('Examples:');
            console.log('  node manage_models.js list');
            console.log('  node manage_models.js replace qwen/qwen-2.5-7b-instruct qwen/qwen3-8b:free');
            console.log('  node manage_models.js add openai/gpt-4o');
            break;
    }
}

// Run the script
main().catch(console.error);