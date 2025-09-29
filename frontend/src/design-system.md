# Design System Overview

This document captures the WhatsApp-inspired design primitives that power the `codex` branch UI.

## Color & Typography Tokens

- Tailwind tokens live in `tailwind.config.js` under the `whatsapp` namespace (`surface`, `panel`, `accent`, `ink`, etc.).
- Global CSS variables in `src/index.css` expose the palette to ShadCN components (`--background`, `--primary`, etc.).
- Primary font families are `font-body` for text and `font-display` (inherited) for headings.

## Layout Primitives

- `.chat-shell` – full-screen flex container with sidebar + conversation pane.
- `.chat-sidebar*` – sidebar building blocks (`__header`, `__list`, `__item`, etc.) created via Tailwind component layer.
- `.chat-main`/`.chat-main__layer` – conversation surface with subtle background pattern.

## Message Bubbles

- `.chat-message` base + modifiers `--incoming`, `--outgoing`, `--system` for different senders.
- Reply context uses `.chat-message__reply` and `.chat-message__reply-bar` to mirror WhatsApp quoting.
- Metadata/footer stored in `.chat-message__meta`.

## Composer & Reply Preview

- `.chat-composer` aligns input, reply preview, character limit, and send button.
- `.chat-reply-preview` aligns with message reply visuals for continuity.

## Components

- `ConversationAvatar` (in `components/ui/avatar.tsx`) deterministically maps conversation titles to color/fallback initials.
- `ModelManager.jsx` uses ShadCN `DropdownMenu` + custom Tailwind tokens for drag-and-drop ordering.
- `EditableDisplayName.jsx` and `ProfilePictureUpload.jsx` now consume shared button/input styling and Tailwind colors.

## Implementation Notes

- Legacy `whatsapp.css` is now a stub; all styling lives in Tailwind layers (`src/index.css`).
- ESLint warnings remain for intentional dependency omissions (see `App.jsx` effects) and should be revisited during future refactors.
- When adding new UI, prefer existing classes/variants before introducing bespoke styling.
