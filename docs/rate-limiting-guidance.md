# 🚦 Client Rate-Limiting Guidance

The backend API enforces rate limits on protected endpoints to ensure service availability and prevent abuse.

## HTTP Headers

Every request to a protected route includes standard rate-limiting headers:

| Header Name | Type | Description |
| :--- | :--- | :--- |
| `X-RateLimit-Limit` | Integer | Total request capacity allowed in the current time window. |
| `X-RateLimit-Remaining` | Integer | Remaining number of requests permitted in the current window. |
| `X-RateLimit-Reset` | Unix Timestamp | Epoch timestamp (in seconds) when the current window resets. |
| `Retry-After` | Integer | Seconds to wait before attempting another request (sent on `429`). |

## Handling `429 Too Many Requests`

When a client exceeds the permitted quota, the API responds with HTTP status `429 Too Many Requests`.

### Error Payload Structure
```json
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Rate limit exceeded. Please try again later.",
    "correlationId": "corr-123456789"
  }
}