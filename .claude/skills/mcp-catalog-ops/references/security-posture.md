# MCP Security Posture

From route comments (P0-017, G7, CCR notes):

- Disabled by default (`MCP_ENABLED`)
- Fail-closed rate limit via shared `api` bucket, key `mcp:${clientIp}`
- Read-only published + public catalog
- Search sanitization strips PostgREST-significant characters: `,()%*\:` and caps length to 100
- No service role key in MCP path
- No manuscript URLs, emails, payment data, or admin tools

When migrating to Mongo, keep equivalent least privilege in application queries
(status/visibility filters in code — there is no RLS).
