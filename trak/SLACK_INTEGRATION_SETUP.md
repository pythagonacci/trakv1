# Slack Integration Setup Guide

## Overview

The Slack integration allows users to interact with Trak's AI system directly from Slack using the `/trak` slash command. This integration includes:

- ✅ OAuth 2.0 workspace connection
- ✅ Account linking (Slack users → Trak users)
- ✅ Slash command handler with AI routing
- ✅ Fortune-500 security (signature verification, encryption, rate limiting, audit logs)
- ✅ Ephemeral responses
- ✅ Interactive context selection (project/tab dropdowns)

---

## Files Created

### Database
- `supabase/migrations/20260209000000_add_slack_integration.sql`
  - Tables: `slack_workspace_connections`, `slack_user_links`, `slack_command_audit_log`, `slack_rate_limits`, `slack_idempotency_keys`
  - Helper functions: `get_workspace_id_from_slack_team`, `is_slack_user_linked`

### Security Utilities (`/lib/slack/`)
- `encryption.ts` - AES-256-GCM token encryption/decryption
- `signature.ts` - Slack signature verification + replay protection
- `rate-limiter.ts` - Sliding window rate limiting
- `idempotency.ts` - Request deduplication
- `audit.ts` - Audit logging helpers
- `types.ts` - TypeScript interfaces for Slack payloads
- `block-kit.ts` - Slack Block Kit response builder

### AI Integration
- `/lib/ai/slack-executor.ts` - Slack-optimized AI wrapper with context detection

### API Routes (`/app/api/slack/`)
- `install/route.ts` - OAuth install initiation (GET)
- `callback/route.ts` - OAuth callback handler (GET)
- `commands/route.ts` - Slash command handler (POST) ⭐ Main entry point
- `interactive/route.ts` - Interactive components handler (POST)
- `disconnect/route.ts` - Disconnect workspace (POST)

### Server Actions
- `/app/actions/slack-connection.ts` - Connection management (list, disconnect)

### UI Pages
- `/app/dashboard/settings/integrations/slack/page.tsx` - Settings page (server component)
- `/app/dashboard/settings/integrations/slack/slack-client.tsx` - Client component
- `/app/dashboard/settings/integrations/slack/link/page.tsx` - Account linking page

---

## Environment Variables

Add to `.env.local`:

```bash
# Slack Integration
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_TOKEN_ENCRYPTION_KEY=<base64_32_bytes>

# Optional (with defaults)
SLACK_RATE_LIMIT_PER_USER_PER_MINUTE=20
SLACK_RATE_LIMIT_PER_TEAM_PER_MINUTE=100
```

### Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Slack App Configuration

### 1. Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name it "Trak" and select your development workspace
4. Copy the **Client ID**, **Client Secret**, and **Signing Secret**

### 2. OAuth & Permissions

Navigate to **OAuth & Permissions** in the Slack app dashboard:

**Redirect URLs:**
```
https://your-ngrok-url.ngrok.io/api/slack/callback
```

**Bot Token Scopes:**
- `commands` - Required for slash commands
- `chat:write` - Required for posting messages
- `users:read` - Required for user info
- `team:read` - Required for team info

### 3. Slash Commands

Navigate to **Slash Commands** → Click "Create New Command":

- **Command:** `/trak`
- **Request URL:** `https://your-ngrok-url.ngrok.io/api/slack/commands`
- **Short Description:** "Interact with Trak AI"
- **Usage Hint:** `[your question or command]`

### 4. Interactivity & Shortcuts

Navigate to **Interactivity & Shortcuts** → Toggle "Interactivity" ON:

- **Request URL:** `https://your-ngrok-url.ngrok.io/api/slack/interactive`

### 5. Install to Workspace

Navigate to **Install App** → Click "Install to Workspace" → Authorize

---

## Local Development Setup

### 1. Run Database Migration

```bash
cd trak/supabase
supabase migration up
```

Or apply manually in Supabase SQL editor:
- Copy contents of `20260209000000_add_slack_integration.sql`
- Paste and execute in Supabase dashboard

### 2. Start ngrok

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 3. Update Slack App URLs

Update these URLs in your Slack app dashboard with your ngrok URL:
- OAuth Redirect URL: `https://abc123.ngrok.io/api/slack/callback`
- Slash Command Request URL: `https://abc123.ngrok.io/api/slack/commands`
- Interactivity Request URL: `https://abc123.ngrok.io/api/slack/interactive`

### 4. Update `.env.local`

```bash
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
SLACK_CLIENT_ID=your_client_id
SLACK_CLIENT_SECRET=your_client_secret
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_TOKEN_ENCRYPTION_KEY=<generated_key>
```

### 5. Start Next.js

```bash
npm run dev
```

---

## Manual Testing Checklist

### Phase 1: OAuth & Connection

- [ ] Admin can navigate to `/dashboard/settings/integrations`
- [ ] Click "Install Slack App" (or similar button)
- [ ] Redirects to Slack OAuth consent screen
- [ ] After approval, redirects back to Trak
- [ ] Connection appears in settings with team name and "Active" status
- [ ] Encrypted token is stored in `slack_workspace_connections` table
- [ ] **Test invalid state:** Wait 6 minutes before authorizing → Should show error

### Phase 2: Account Linking

- [ ] Unlinked user runs `/trak search tasks` in Slack
- [ ] Receives ephemeral message with account link URL
- [ ] Click link URL → Redirects to Trak login if not authenticated
- [ ] After login, shows "Account Linked Successfully!" message
- [ ] Verify `slack_user_links` table has entry with `link_status = 'active'`
- [ ] Run `/trak search tasks` again → Should work now

### Phase 3: Slash Commands

#### Basic Commands
- [ ] `/trak search tasks` → Returns list of tasks (ephemeral)
- [ ] `/trak search overdue tasks` → Returns overdue tasks
- [ ] `/trak show projects` → Returns list of projects
- [ ] `/trak search docs` → Returns documents

#### Creation Commands (with context prompt)
- [ ] `/trak create task Review Q1 report` → Prompts for project selection
- [ ] Select a project from dropdown → Task is created
- [ ] Verify task appears in Trak web UI

#### Error Handling
- [ ] `/trak invalid command xyz` → Returns friendly error message
- [ ] All responses are ephemeral (only visible to you)

### Phase 4: Security

#### Signature Verification
- [ ] Send request with invalid signature → Returns 401
- [ ] Send request with timestamp >5 minutes old → Returns 401
- [ ] Valid signature → Works correctly

#### Rate Limiting
- [ ] Run 20 commands in quick succession → 21st should return rate limit error
- [ ] Wait 60 seconds → Rate limit resets

#### Idempotency
- [ ] Run same command twice rapidly (Slack retries) → Returns cached response
- [ ] No duplicate entries in `slack_command_audit_log`

#### Audit Logging
- [ ] Run several commands
- [ ] Check `slack_command_audit_log` table
- [ ] Verify all commands are logged with:
  - `command_text`
  - `response_status` (success/error/unauthorized/rate_limited)
  - `execution_time_ms`
  - `tools_used` array

### Phase 5: Edge Cases

- [ ] Disconnect Slack workspace → Verify all `slack_user_links` have `link_status = 'revoked'`
- [ ] Delete Trak workspace → Verify cascading delete to Slack tables
- [ ] Multiple Slack users linking to same Trak user → Should work
- [ ] Same Slack user linking to multiple Trak users → Only one link per Slack workspace
- [ ] Idempotency keys expire after 24 hours (check `slack_idempotency_keys` table)

---

## Testing with Different User Roles

### Admin/Owner
- Can install Slack app
- Can disconnect Slack app
- Can view audit logs (future enhancement)

### Teammate
- Cannot install/disconnect Slack app
- Can link their own account
- Can use `/trak` commands

### Unlinked User
- Receives "Please link your account" message
- Link URL works correctly
- After linking, can use commands

---

## Troubleshooting

### "Invalid signature" error
- Verify `SLACK_SIGNING_SECRET` is correct
- Check that request body is being read as raw text (not parsed)
- Ensure timestamp is within 5-minute window

### "Connection not found" error
- Run the database migration
- Verify `slack_workspace_connections` table exists
- Check that OAuth callback succeeded (check connection in DB)

### Account linking doesn't work
- Verify `NEXT_PUBLIC_APP_URL` is set to your ngrok URL
- Check that user is authenticated before reaching link page
- Verify `slack_user_links` table exists

### Rate limiting not working
- Check `slack_rate_limits` table exists
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check console logs for errors

### Commands timing out
- Slack requires response within 3 seconds
- Immediate acknowledgment is sent
- Actual processing happens asynchronously
- Check `response_url` POST is succeeding

---

## Architecture Decisions

1. **Async Command Processing** - Immediate ack (< 3sec) + background execution via `response_url`
2. **Context Detection** - Detects missing project/tab from command text, prompts with dropdown
3. **Read-Only by Default** - Requires explicit creation verbs to allow mutations
4. **Limited Tool Groups** - Only "core", "task", "project", "doc" (no blocks, timelines)
5. **Ephemeral Responses** - All responses visible only to requesting user
6. **Shared OAuth States** - Reuses `oauth_states` table from Shopify integration
7. **Service Client for Commands** - Slash command handler uses service role (bypasses RLS)
8. **Soft Delete** - Sets `connection_status = 'disconnected'` instead of hard delete
9. **Two-Tier Rate Limiting** - Per-user (20/min) + per-team (100/min)
10. **24-Hour Idempotency** - Caches responses for duplicate detection

---

## Next Steps (Future Enhancements)

- [ ] Multi-workspace support (v2): Allow one Slack team to access multiple Trak workspaces
- [ ] Rich formatting: Use Slack Block Kit for task lists, charts
- [ ] Slack events: Respond to mentions, channel messages
- [ ] Shortcuts: Quick actions from message context menus
- [ ] App Home: Dedicated home tab with recent activity
- [ ] Direct messages: Support DMs to the bot
- [ ] Scheduled messages: Daily summaries, reminders
- [ ] Admin dashboard: View usage analytics, audit logs in Trak UI

---

## Security Considerations

✅ **Implemented:**
- Slack signature verification (HMAC-SHA256)
- Replay attack protection (5-minute timestamp window)
- Token encryption (AES-256-GCM)
- Rate limiting (per-user and per-team)
- Idempotency (24-hour deduplication)
- Audit logging (all commands logged)
- RLS policies (workspace isolation)
- Service role for sensitive operations
- Soft delete (audit trail preservation)

⚠️ **Production Checklist:**
- [ ] Rotate `SLACK_TOKEN_ENCRYPTION_KEY` periodically
- [ ] Monitor `slack_command_audit_log` for suspicious activity
- [ ] Set up alerts for rate limit violations
- [ ] Review RLS policies for all tables
- [ ] Enable pg_cron for idempotency cleanup (hourly)
- [ ] Add error monitoring (Sentry, LogRocket, etc.)
- [ ] Test with multiple concurrent users

---

## Support

For issues or questions:
1. Check this guide first
2. Review `slack_command_audit_log` for errors
3. Check Supabase logs
4. Check ngrok inspector (http://localhost:4040)
5. Review Slack app event logs in API dashboard

Happy Slacking! 🎉
