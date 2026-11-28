# Shared chat

One `/chat` room for all active members, protected by the existing session and Origin checks. There are no room IDs, private messages, or room-creation routes. Portraits use each owner's representative character. Chat presence means connections currently open to the chat page; multiple tabs count once.

## Storage and events
- Apply `migrations/0006_shared_chat.sql` to add append-only `chat_messages`. Messages have a monotonically increasing DB ID and a unique `(member_id, client_message_id)` request key. Retrying the same body returns the canonical message. Presence/typing are socket attachments, not D1 records.
- `ChatRoom` is a separate hibernating Durable Object, bound as `CHAT`, always named `all-members`. Messages are accepted over authenticated HTTP and broadcast over WebSocket only after D1 commits. All history reads require a valid active session. Bodies are text, capped at 2,000 UTF-16 code units; chat sends are limited to 30 per member per minute plus the shared write limiter.
- New connections and reconnects read history by DB ID until all gap pages arrive. Live events and HTTP acknowledgements merge by message ID. The newest page is 50 messages; older pages load at the top while preserving a visible anchor. No history polling runs while idle.
- Typing events are client-throttled (2s), idle-clear at 2.5s, and expire server-side after 6s. Socket bursts are capped. Ping/pong heartbeats do not query D1; leases clear dead connections after about 75 seconds, with automatic reconnect. Alarms expire typing and session leases; no periodic D1 presence reads are used. Server writes refresh active-session checks, and account changes/logout/restore trigger revocation/refresh.
- Backups include chat messages; temporary presence and typing are not backed up. Rebuild and update the Apps Script deployment to add the categorized `잡담/메시지.json` export; raw server snapshots already include the table after the Worker update.

## Applying the change
1. Locally: `npm run db:local` (or `npm run dev`) applies the isolated local migration.
2. Production: back up first; apply only the new migration to the alliance D1 via `npm run db:remote`, then deploy Worker with the updated config (adds `ChatRoom` class migration and `CHAT_RATE_LIMITER`), then build/deploy Pages. Do not run migrations against the unrelated TRPG database.
3. Verify two different member accounts, two tabs for one account, disconnect/reconnect, Korean composition, and the mobile keyboard. This implementation task does not itself deploy or modify production data.
