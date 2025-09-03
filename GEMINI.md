
# Project Overview

This is a group chat application that allows users to interact with multiple AI models simultaneously. The application is designed to have a user interface that mimics WhatsApp.

## Frontend

*   **Framework:** React
*   **Build Tool:** Vite
*   **Styling:**
    *   Tailwind CSS
    *   A custom `whatsapp.css` file is used to provide a WhatsApp-like look and feel.
*   **Communication:** The frontend communicates with the backend via a REST API.

## Backend

*   **Framework:** Node.js with Express
*   **LLM Integration:** The backend integrates with OpenRouter to access a variety of large language models.
*   **Configuration:** The application uses a `.env` file for configuration, which includes the `OPENROUTER_API_KEY`.

## AI Models

The application is configured to use the following models:

*   `google/gemini-flash-1.5`
*   `openai/gpt-4o-mini`
*   `anthropic/claude-3.5-sonnet`
*   `meta-llama/llama-3-8b-instruct`
