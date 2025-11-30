const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Configuration
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CHAIRMAN_MODEL = 'openai/gpt-4o-mini'; // Default chairman

// Helper: Call OpenRouter (Replicated from index.js for isolation)
async function callOpenRouter(model, prompt, history = [], maxLength = 2000, systemPrompt = '') {
    try {
        const messages = [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...history,
            { role: 'user', content: prompt }
        ];

        const headers = {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_REFERER || 'http://localhost:5173',
            'X-Title': process.env.APP_TITLE || 'AI Group Chat',
        };

        const payload = {
            model: model,
            messages,
        };

        // For council mode, we generally want longer responses, so we default to a higher limit or omit it
        if (typeof maxLength === 'number' && Number.isFinite(maxLength) && maxLength > 0) {
            payload.max_tokens = Math.max(1, Math.ceil(maxLength / 4));
        }

        const response = await axios.post(API_URL, payload, { headers });
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error(`Error calling model ${model}:`, error.message);
        return null; // Return null on failure so we can filter it out
    }
}

// Stage 1: Collect individual responses
async function stage1_collect_responses(userQuery, models, res) {
    res.write(`data: ${JSON.stringify({ type: 'stage1_start', models })}\n\n`);

    const promises = models.map(async (model) => {
        const response = await callOpenRouter(model, userQuery, [], 2000);
        if (response) {
            res.write(`data: ${JSON.stringify({
                type: 'stage1_result',
                model,
                response
            })}\n\n`);
            return { model, response };
        }
        return null;
    });

    const results = await Promise.all(promises);
    return results.filter(r => r !== null);
}

// Stage 2: Review and Rank
async function stage2_collect_rankings(userQuery, stage1Results, res) {
    res.write(`data: ${JSON.stringify({ type: 'stage2_start' })}\n\n`);

    // Anonymize
    const labels = stage1Results.map((_, i) => String.fromCharCode(65 + i)); // A, B, C...
    const labelToModel = {};
    stage1Results.forEach((result, i) => {
        labelToModel[`Response ${labels[i]}`] = result.model;
    });

    const responsesText = stage1Results.map((result, i) =>
        `Response ${labels[i]}:\n${result.response}`
    ).join('\n\n');

    const rankingPrompt = `You are evaluating different responses to the following question:

Question: ${userQuery}

Here are the responses from different models (anonymized):

${responsesText}

Your task:
1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Example of the correct format for your ENTIRE response:

Response A provides good detail on X but misses Y...
Response B is accurate but lacks depth on Z...
Response C offers the most comprehensive answer...

FINAL RANKING:
1. Response C
2. Response A
3. Response B

Now provide your evaluation and ranking:`;

    // Ask all models to rank (excluding those that failed stage 1)
    const participatingModels = stage1Results.map(r => r.model);

    const promises = participatingModels.map(async (model) => {
        const response = await callOpenRouter(model, rankingPrompt, [], 2000);
        if (response) {
            res.write(`data: ${JSON.stringify({
                type: 'stage2_result',
                model,
                ranking: response
            })}\n\n`);
            return { model, ranking: response };
        }
        return null;
    });

    const results = await Promise.all(promises);
    return {
        rankings: results.filter(r => r !== null),
        labelToModel
    };
}

// Stage 3: Synthesize
async function stage3_synthesize_final(userQuery, stage1Results, stage2Results, res) {
    res.write(`data: ${JSON.stringify({ type: 'stage3_start' })}\n\n`);

    const stage1Text = stage1Results.map(r =>
        `Model: ${r.model}\nResponse: ${r.response}`
    ).join('\n\n');

    const stage2Text = stage2Results.map(r =>
        `Model: ${r.model}\nRanking: ${r.ranking}`
    ).join('\n\n');

    const chairmanPrompt = `You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: ${userQuery}

STAGE 1 - Individual Responses:
${stage1Text}

STAGE 2 - Peer Rankings:
${stage2Text}

Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the council's collective wisdom:`;

    // Stream the chairman's response
    // Note: For simplicity in this v1, we'll just wait for the full response and send it. 
    // Ideally we would stream this too, but our callOpenRouter helper is not streaming-enabled yet.
    // We can update callOpenRouter to support streaming later if needed.

    const response = await callOpenRouter(CHAIRMAN_MODEL, chairmanPrompt, [], 4000);

    if (response) {
        res.write(`data: ${JSON.stringify({
            type: 'stage3_result',
            model: CHAIRMAN_MODEL,
            response
        })}\n\n`);
    } else {
        res.write(`data: ${JSON.stringify({
            type: 'error',
            message: 'Chairman failed to synthesize response.'
        })}\n\n`);
    }
}

// Main Handler
async function handleCouncilRequest(req, res) {
    const { prompt, selectedModels } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!selectedModels || selectedModels.length < 2) {
        return res.status(400).json({ error: 'At least 2 models are required for a council.' });
    }

    // Set up SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    try {
        // Stage 1
        const stage1Results = await stage1_collect_responses(prompt, selectedModels, res);

        if (stage1Results.length === 0) {
            throw new Error('All models failed to respond in Stage 1.');
        }

        // Stage 2
        const { rankings: stage2Results, labelToModel } = await stage2_collect_rankings(prompt, stage1Results, res);

        // Stage 3
        await stage3_synthesize_final(prompt, stage1Results, stage2Results, res);

        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();

    } catch (error) {
        console.error('Council Error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
}

module.exports = { handleCouncilRequest };
