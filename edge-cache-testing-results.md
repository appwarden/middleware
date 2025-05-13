# Edge cache testing

Results from sending traffic to API using [load testing script](../../scripts/test-appwarden-vercel-caching.ts)

Measured using [Vercel Logs](https://vercel.com/appwardens-projects-d87f015a/appwarden-online/logs)

### Requests received by API with @appwarden/middleware edge caching

> API = staging-bot-gateway.appwarden.io

| Rate (RPS) | Time (minutes) | Cache Timeout (s) | Sent  | Expected | Actual                   | Inits | Init Rate (min) |
| ---------- | -------------- | ----------------- | ----- | -------- | ------------------------ | ----- | --------------- |
| .2         | 2              | 15                | 24    | 8        | 7/7/7 (7)                | 10/11 | 5               |
| 1          | 5              | 15                | 300   | 20       | 36/40/41/44/38 (39.8)    | 15    | 3               |
| 5          | 2              | 15                | 600   | 8        | 44/35/42/35/36/35 (37.8) | 9     | 4.5             |
| 20         | 2              | 15                | 2,400 | 8        | 62                       | 10    | 5               |

| Rate (RPS) | Time (minutes) | Cache Timeout (s) | Sent  | Expected | Actual              | Inits | Init Rate (min) | Edge updates from API |
| ---------- | -------------- | ----------------- | ----- | -------- | ------------------- | ----- | --------------- | --------------------- |
| 20         | 2              | 30                | 2,400 | 4        | 193/192/201/130/215 | ??    | ??              | 20/23/21/20           |

Notes:

- In high RPS tests, Actual significantly deviates from Expected, which may be due to the misbehaving memory cache during the first part of the experiment. After 30-45 seconds, the memoryCache seems to begin correctly limiting api requests, and throughout drops significantly.
