## Build, Lint, and Test Commands

### Frontend

- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Run:** `npm run dev`

### Backend

- **Run:** `npm run dev`
- **Start for production:** `npm run start`

## Code Style Guidelines

- **Formatting:** Follow standard JavaScript/React formatting. Use Prettier with default settings if available.
- **Imports:** Use ES module imports (`import/export`).
- **Types:** This project does not use TypeScript. Use JSDoc for type annotations where necessary.
- **Naming Conventions:**
  - Components: `PascalCase`
  - Variables/Functions: `camelCase`
  - Constants: `UPPER_CASE`
- **Error Handling:** Use `try...catch` blocks for asynchronous operations and handle errors gracefully.
- **Linting:** Adhere to the rules in `eslint.config.js`. Unused variables are allowed if they start with an uppercase letter.
