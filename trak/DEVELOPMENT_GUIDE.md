# Development Guide

This document outlines critical patterns, conventions, and gotchas that must be followed consistently when continuing development on this project.

## Table of Contents
1. [Workspace Management](#workspace-management)
2. [Supabase Client Usage](#supabase-client-usage)
3. [Next.js 15 Patterns](#nextjs-15-patterns)
4. [Server Actions](#server-actions)
5. [Error Handling](#error-handling)
6. [File Structure](#file-structure)

---

## Workspace Management

### ⚠️ CRITICAL: Workspace Cookie Name

**NEVER directly access the workspace cookie by name. Always use the helper function.**

#### ❌ WRONG:
```typescript
import { cookies } from "next/headers";

const cookieStore = await cookies();
const workspaceId = cookieStore.get("workspace_id")?.value; // ❌ WRONG COOKIE NAME
```

#### ✅ CORRECT:
```typescript
import { getCurrentWorkspaceId } from "@/app/actions/workspace";

const workspaceId = await getCurrentWorkspaceId();
```

### Why This Matters
- The actual cookie name is `trak_current_workspace` (defined in `src/app/actions/workspace.ts`)
- If you use the wrong cookie name (`workspace_id`), the workspace will be `null` and users will be redirected to `/dashboard`
- This causes the "clicking project redirects to dashboard" bug that we fixed

### Workspace Helper Functions

All workspace operations should use functions from `@/app/actions/workspace`:

- **Get workspace ID**: `await getCurrentWorkspaceId()` → Returns `string | null`
- **Update workspace cookie**: `await updateCurrentWorkspace(workspaceId)`
- **Get user workspaces**: `await getUserWorkspaces()`

### Workspace Validation Pattern

When creating/updating workspace-scoped resources, always verify membership:

```typescript
// Check if user is a member of the workspace
const { data: membership, error: memberError } = await supabase
  .from('workspace_members')
  .select('role')
  .eq('workspace_id', workspaceId)
  .eq('user_id', user.id)
  .maybeSingle()

if (memberError || !membership) {
  return { error: 'You must be a workspace member to perform this action' }
}
```

---

## Supabase Client Usage

### Server-Side (Server Components, Server Actions, API Routes)

**Always use** `@/lib/supabase/server`:

```typescript
import { createClient } from "@/lib/supabase/server";

// IMPORTANT: createClient() is async in server context
const supabase = await createClient();
```

**Key points:**
- The function is `async` and must be awaited
- It handles cookie-based authentication automatically
- Use in Server Components, Server Actions, and API route handlers

### Client-Side (Client Components)

**Always use** `@/lib/supabase/client`:

```typescript
import { createClient } from "@/lib/supabase/client";

// This is synchronous (no await needed)
const supabase = createClient();
```

**Key points:**
- This function is synchronous (no `await`)
- Use only in Client Components (`"use client"`)
- Do NOT use the server client in client components

### Middleware

In `middleware.ts`, use `createServerClient` directly from `@supabase/ssr`:

```typescript
import { createServerClient } from "@supabase/ssr";

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      // ... set/remove methods
    },
  }
);
```

---

## Next.js 15 Patterns

### Route Parameters

In Next.js 15, `params` is now a Promise and must be awaited:

#### ✅ CORRECT Pattern:
```typescript
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  
  // Use projectId...
}
```

#### ❌ WRONG (Next.js 14 pattern):
```typescript
export default async function ProjectPage({
  params,
}: {
  params: { projectId: string };
}) {
  const projectId = params.projectId; // ❌ This will fail in Next.js 15
}
```

### Search Parameters

Similarly, `searchParams` is also a Promise:

#### ✅ CORRECT Pattern:
```typescript
interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  
  // Use params...
}
```

---

## Server Actions

### File Location
All server actions live in `src/app/actions/` directory:
- `auth.ts` - Authentication actions
- `workspace.ts` - Workspace management
- `project.ts` - Project CRUD operations
- `client.ts` - Client CRUD operations
- `tab.ts` - Tab management

### Action Structure

All server actions must:
1. Start with `'use server'` directive
2. Import Supabase client from `@/lib/supabase/server`
3. Validate authentication
4. Validate workspace membership (if workspace-scoped)
5. Return `{ data, error }` pattern

#### Standard Pattern:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function myAction(workspaceId: string, data: SomeData) {
  const supabase = await createClient()
  
  // 1. Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized' }
  }
  
  // 2. Workspace membership check
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()
  
  if (!membership) {
    return { error: 'You must be a workspace member' }
  }
  
  // 3. Perform action
  const { data, error } = await supabase
    .from('table')
    .insert({ ... })
    .select()
    .single()
  
  if (error) {
    return { error: error.message }
  }
  
  // 4. Revalidate paths if needed
  revalidatePath('/dashboard')
  
  return { data }
}
```

### Return Value Pattern

Always return objects with `{ data, error }` structure:
- Success: `{ data: T }`
- Error: `{ error: string }`

Never throw errors; return error objects instead.

---

## Error Handling

### Server Actions
Always return error objects, never throw:

```typescript
// ✅ CORRECT
if (error) {
  return { error: error.message }
}

// ❌ WRONG
if (error) {
  throw new Error(error.message) // Don't throw in server actions
}
```

### Client Components
Handle errors from server actions:

```typescript
const result = await myServerAction(data);

if (result.error) {
  setToast({ message: result.error, type: "error" });
  // Handle error (revert optimistic update, etc.)
  return;
}

// Handle success
```

### Not Found vs Redirect

Use `notFound()` when a resource doesn't exist:
```typescript
if (!project) {
  notFound(); // Renders not-found.tsx
}
```

Use `redirect()` for authentication/authorization failures:
```typescript
if (!user) {
  redirect("/login");
}
```

---

## File Structure

### App Router Structure
```
src/app/
├── actions/          # Server actions (all files have 'use server')
├── api/              # API route handlers
├── auth/             # Auth routes
├── dashboard/        # Dashboard routes
│   ├── projects/
│   │   ├── [projectId]/  # Dynamic route
│   │   └── page.tsx
│   └── layout.tsx
└── globals.css
```

### Component Organization
```
src/components/
├── auth/             # Auth-related components
└── ui/               # Reusable UI components (shadcn/ui)
```

### Utilities
```
src/lib/
├── supabase/
│   ├── client.ts     # Client-side Supabase
│   └── server.ts     # Server-side Supabase
├── auth/             # Auth utilities
└── utils.ts          # General utilities
```

---

## Quick Reference Checklist

When creating a new feature:

- [ ] ✅ Use `getCurrentWorkspaceId()` instead of directly accessing cookies
- [ ] ✅ Use correct Supabase client (`/server` for server, `/client` for client)
- [ ] ✅ Await `createClient()` in server context
- [ ] ✅ Await `params` and `searchParams` in Next.js 15
- [ ] ✅ Add `'use server'` directive to server actions
- [ ] ✅ Validate authentication in server actions
- [ ] ✅ Validate workspace membership for workspace-scoped actions
- [ ] ✅ Return `{ data, error }` pattern from server actions
- [ ] ✅ Never throw errors in server actions
- [ ] ✅ Revalidate paths after mutations
- [ ] ✅ Use `notFound()` for missing resources, `redirect()` for auth failures

---

## Common Pitfalls

### ❌ Pitfall 1: Wrong Cookie Name
```typescript
// This will silently fail and redirect users
const workspaceId = cookieStore.get("workspace_id")?.value;
```
**Fix**: Use `await getCurrentWorkspaceId()`

### ❌ Pitfall 2: Forgetting to Await Params
```typescript
// This will cause runtime errors in Next.js 15
const projectId = params.projectId;
```
**Fix**: `const { projectId } = await params;`

### ❌ Pitfall 3: Using Server Client in Client Component
```typescript
// This will cause build/runtime errors
"use client";
import { createClient } from "@/lib/supabase/server";
```
**Fix**: Use `@/lib/supabase/client` in client components

### ❌ Pitfall 4: Not Awaiting createClient()
```typescript
// This will return a Promise, not a client
const supabase = createClient();
```
**Fix**: `const supabase = await createClient();`

---

## Additional Notes

- **Dynamic Pages**: Pages that fetch user-specific data should have:
  ```typescript
  export const dynamic = "force-dynamic";
  export const revalidate = 0;
  ```

- **Type Safety**: Use TypeScript types from database schema when available

- **Optimistic Updates**: Client components can use optimistic updates for better UX, but should handle rollback on error

---

## Questions?

If you encounter patterns not covered here, check existing files for examples:
- Server actions: `src/app/actions/`
- Server components: `src/app/dashboard/`
- Client components: Any file with `"use client"`

---

**Last Updated**: Based on Next.js 15 and current codebase patterns

