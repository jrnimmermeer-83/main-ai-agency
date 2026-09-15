# Environment template

Copy these names into a local `.env.local` file and replace the placeholder text in your deployment platform’s secret manager. **Do not commit the resulting file.**

```dotenv
# Runtime
NODE_ENV=development
PORT=3000

# Database: MySQL-compatible connection string for Drizzle
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE

# Manus OAuth and signed sessions
JWT_SECRET=replace_with_a_long_random_secret
OAUTH_SERVER_URL=https://api.manus.im
VITE_APP_ID=replace_with_manus_app_id
VITE_OAUTH_PORTAL_URL=https://manus.im
OWNER_OPEN_ID=replace_with_owner_open_id

# Server-side Manus Forge: AI, model list, storage, and notifications
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=replace_with_server_only_forge_key

# Optional frontend Forge configuration. Never substitute a private server key here.
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
VITE_FRONTEND_FORGE_API_KEY=

# Optional analytics identifiers
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=

# Reserved for future direct provider adapters; server-side only
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
```

## Important notes

The current application reads `BUILT_IN_FORGE_API_KEY` for its AI wrapper rather than directly reading an OpenAI key. The `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GOOGLE_API_KEY` names are deliberately reserved for a future direct-provider adapter. Do not place any of these values in `VITE_*` variables, React source files, browser storage, or a public GitHub repository.
