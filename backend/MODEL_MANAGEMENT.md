# AI Model Management Tool

This script provides a unified way to manage AI models in the Supabase database without creating temporary fix scripts.

## Usage

```bash
node manage_models.js <command> [arguments]
```

## Commands

### List Current Models
```bash
node manage_models.js list
```
Shows all models currently in the database with their active status.

### List Available Models
```bash
node manage_models.js available
```
Shows all models available for addition with their details.

### Add a New Model
```bash
node manage_models.js add <model_id>
```
Adds a new model to the database.

Example:
```bash
node manage_models.js add openai/gpt-4o
```

### Replace a Model
```bash
node manage_models.js replace <old_model_id> <new_model_id>
```
Replaces an existing model with a new one, updating all references in messages and conversations.

Example:
```bash
node manage_models.js replace qwen/qwen3-max-thinking qwen/qwen3-8b:free
```

### Remove a Model
```bash
node manage_models.js remove <model_id>
```
Removes a model that isn't referenced in any messages or conversations.

Example:
```bash
node manage_models.js remove openai/gpt-3.5-turbo
```

### Toggle Model Status
```bash
node manage_models.js toggle <model_id>
```
Toggles the active/inactive status of a model.

Example:
```bash
node manage_models.js toggle deepseek/deepseek-coder
```

## Available Models

The script includes pre-defined configurations for popular models from:
- **Google**: Gemini 2.5 Flash, Gemini 1.5 Flash, etc.
- **OpenAI**: GPT-4o, GPT-4o Mini, GPT-3.5 Turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku
- **Meta**: Llama 3 8B, Llama 3 70B
- **DeepSeek**: DeepSeek V3.2, DeepSeek Coder
- **Qwen**: Qwen3 Max Thinking and other Qwen variants

## Workflow for Model Changes

1. **Test the new model**: Verify it works with OpenRouter API
2. **Replace in database**: `node manage_models.js replace old_model new_model`
3. **Update code**: Update model IDs in `index.js`, `App.jsx`, and `database.js`
4. **Restart server**: Restart the backend to use the new model

## Safety Features

- **Reference checking**: Won't delete models that are referenced in messages/conversations
- **Validation**: Validates model IDs against the available models list
- **Atomic operations**: Replace operations are handled safely with proper error handling
- **Rollback safe**: Old model remains if new model addition fails

## Example Workflow

```bash
# Check current models
node manage_models.js list

# Replace a problematic model
node manage_models.js replace qwen/qwen3-max-thinking qwen/qwen3-8b:free

# Verify the change
node manage_models.js list

# Add a new experimental model
node manage_models.js add openai/gpt-4o

# Remove unused model (if not referenced)
node manage_models.js remove openai/gpt-3.5-turbo
```

This eliminates the need for creating one-off fix scripts and provides a consistent interface for model management.
