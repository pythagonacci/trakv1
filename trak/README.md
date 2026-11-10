# Trak application — developer setup

This directory contains the Next.js application for **Trak**, a project workspace with an agentic AI command system. For the feature overview, system architecture, AI execution flow, retrieval pipeline, and performance engineering notes, see the **[repository README](../README.md)**.

## Requirements

- Node.js 20 (`.nvmrc`) and npm.
- A Supabase development project with the migrations in `supabase/migrations/` applied.
- A valid Supabase URL and anonymous key for the application.
- At least one chat provider API key to execute AI commands (OpenAI or DeepSeek).
- An OpenAI API key when using embedding-based indexing/search or file analysis.

## Local setup

```bash
cd trak
nvm use
npm ci
```

Create `.env.local` in this directory:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI command execution: configure one or both providers
OPENAI_API_KEY=your_openai_api_key
# DEEPSEEK_API_KEY=your_deepseek_api_key
# AI_PROVIDER=openai

# Server-side privileged tasks/indexing jobs may require
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: model configuration
# OPENAI_EMBEDDINGS_MODEL=text-embedding-3-small
# DEEPSEEK_MODEL=deepseek-v3.2
```

Apply the SQL migrations to the correct Supabase development project using the Supabase CLI before using database-backed functionality. Additional integrations (Stripe, Google Drive, Google Calendar, Slack, Shopify, email) have their own credentials and callback setup; they are not necessary for every development path.

```bash
npm run dev
```

Navigate to http://localhost:3000.

> **Credential note:** `OPENAI_API_KEY` is required for the embedding pipeline in `src/lib/file-analysis/embeddings.ts`. The earlier README's implication that DeepSeek embeddings are an interchangeable fallback was outdated. Keep API keys and Supabase service-role credentials server-side and out of version control.

## Development commands

```bash
npm test            # Vitest unit tests
npm run lint        # ESLint
npm run build       # Next.js production build
npm run build:analyze  # bundle analyzer
```

## Where to start in the code

| What you want to inspect | Path |
| --- | --- |
| Agent routing and execution | `src/lib/ai/executor.ts` |
| 95 defined AI tool specifications | `src/lib/ai/tool-definitions.ts` |
| Application tool dispatch | `src/lib/ai/tool-executor.ts` |
| Deterministic no-LLM commands | `src/lib/ai/deterministic-parser.ts`, `src/lib/ai/simple-commands.ts` |
| User-facing streaming endpoint | `src/app/api/ai/stream/route.ts` |
| RAG indexing and retrieval | `src/lib/search/indexer.ts`, `src/lib/search/query.ts` |
| Application operations | `src/app/actions/` |
| Workspace UI | `src/app/dashboard/`, `src/components/` |
| Migrations | `supabase/migrations/` |

## Validation status

The project includes Vitest tests and instrumentation for UI/data-path and AI timings. This documentation describes source-code functionality; it does not assert that the full application, provider integrations, or every test currently runs successfully in a freshly provisioned environment.
