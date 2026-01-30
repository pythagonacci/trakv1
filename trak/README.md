This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## File Analysis (Local)

This project includes a file analysis chat sidebar that extracts and analyzes files with DeepSeek.

### Required env vars

Add these to `.env.local`:

```
DEEPSEEK_API_KEY=your_key
DEEPSEEK_MODEL=deepseek-v3.2
DEEPSEEK_EMBEDDINGS_MODEL=deepseek-embedding
```

Optional (used for embeddings if DeepSeek embeddings are unavailable):

```
OPENAI_API_KEY=your_key
OPENAI_EMBEDDINGS_MODEL=text-embedding-3-small
```

### Database

Apply the new migration:

```
supabase migration up
```

### Tests

Run the file analysis tests:

```
npx tsx scripts/test-file-analysis.ts
```

Save action tests will run only if `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.
