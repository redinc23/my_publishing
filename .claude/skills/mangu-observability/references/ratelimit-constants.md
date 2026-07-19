# Rate Limit Constants

| Scope         | Limit               | Window | Notes           |
| ------------- | ------------------- | ------ | --------------- |
| `/api/*`      | 100                 | 60s    | per IP          |
| `/api/auth/*` | 10                  | 60s    | stricter        |
| `/api/health` | unlimited           | —      | whitelist       |
| MCP           | shared `api` bucket | —      | key `mcp:${ip}` |

False positives on legitimate traffic → raise window / whitelist IP (ops skill + human).
