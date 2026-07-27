### 🔒 Security Audit Event Reference: Admin Access Denial

When investigating suspicious activities or unauthorized payout attempts, search log aggregators (e.g., Datadog, ELK) for the `ADMIN_ACCESS_DENIED` event name.

* **Audit Event Name**: `ADMIN_ACCESS_DENIED`
* **Logged Fields**: `correlationId`, `route`, `method`, `reasonCategory`, `callerFingerprint`, `timestamp`.
* **Reason Categories**:
  * `MISSING_API_KEY`: Request missing required `X-Admin-Api-Key` header.
  * `WRITES_DISABLED`: Admin mutation attempted while `ADMIN_WRITES_ENABLED=false`.
  * `UNAUTHORIZED_ROLE`: Authenticated user lacks `PAYMENTS_ADMIN` privileges.
  * `MALFORMED_PAYLOAD`: Empty or structurally invalid body submitted to write endpoint.

> **Note**: API keys, JWT tokens, secrets, and raw request bodies are explicitly excluded from audit payloads to maintain compliance.