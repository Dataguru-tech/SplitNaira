# Production Secret Rotation Procedure

This runbook details the step-by-step procedures for rotating critical production credentials in SplitNaira. Follow the specified deployment sequences to ensure zero downtime and prevent accidental lockouts during incident response or routine maintenance.

---

## 📋 Overview & Scope

| Secret Category | Environment Variables | Max Stale Grace Period | Impact if Misconfigured |
| :--- | :--- | :--- | :--- |
| **Payment Admin Keys** | `PAYMENTS_ADMIN_API_KEY` | None (Instant Cutover) | Failure of admin payout operations |
| **JWT Secrets** | `JWT_SECRET`, `JWT_REFRESH_SECRET` | Dual-key overlap (24 hours) | User session invalidation / forced logout |
| **Database Credentials** | `DATABASE_URL`, `DATABASE_PASSWORD` | DB-dependent | API downtime / DB connection pooling errors |
| **Soroban Operator Secrets** | `SOROBAN_OPERATOR_SECRET_KEY` | Instant Cutover | On-chain settlement & transaction failure |

---

## 🔐 1. General Rotation Principles

1. **Dual-Key Staging**: When rotating asymmetric keys or JWT signing secrets, stage the new secret as secondary before making it primary.
2. **Sequential Rolling Deployment**: Always update and verify the worker/backend pods before terminating old secret versions.
3. **Rollback Readiness**: Keep previous secret references in secure vault history until post-verification steps pass.

---

## 🚀 2. Secret-Specific Rotation Procedures

### A. Payment Admin Keys (`PAYMENTS_ADMIN_API_KEY`)

1. **Preparation**:
   * Generate a secure 256-bit entropy key:
     ```bash
     openssl rand -hex 32
     ```
   * Update the secret vault (e.g., AWS Secrets Manager / HashiCorp Vault) with key `PAYMENTS_ADMIN_API_KEY_NEW`.
2. **Deployment Order**:
   * Deploy API backend services with support for both `PAYMENTS_ADMIN_API_KEY` and `PAYMENTS_ADMIN_API_KEY_NEW`.
   * Update internal client applications / webhooks to consume the new key.
   * Update `PAYMENTS_ADMIN_API_KEY` in environment variables and perform a rolling restart.
3. **Verification**:
   * Execute an authenticated test admin request using the **new** API key:
     ```bash
     curl -i -H "X-Admin-Api-Key: <NEW_KEY>" [https://api.splitnaira.com/v1/admin/health](https://api.splitnaira.com/v1/admin/health)
     ```
     *Expect `HTTP 200 OK`*.
   * Verify old key revocation:
     ```bash
     curl -i -H "X-Admin-Api-Key: <OLD_KEY>" [https://api.splitnaira.com/v1/admin/health](https://api.splitnaira.com/v1/admin/health)
     ```
     *Expect `HTTP 401 Unauthorized`*.

---

### B. JWT Secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`)

1. **Preparation**:
   * Generate new primary signing secret strings.
   * Set `JWT_SECRET_PREVIOUS=<OLD_JWT_SECRET>` in vault settings to allow existing non-expired tokens to validate during transition.
2. **Deployment Sequence**:
   * **Phase 1**: Deploy services with `JWT_SECRET=<NEW_SECRET>` and `JWT_SECRET_PREVIOUS=<OLD_SECRET>`. All *new* tokens will be signed with `<NEW_SECRET>`, while existing user tokens remain valid.
   * **Phase 2 (After 24 Hours)**: Remove `JWT_SECRET_PREVIOUS` environment variable and perform a rolling deployment.
3. **Verification**:
   * Verify token issuance with the new key via `POST /v1/auth/login`.
   * Confirm old tokens issued prior to Phase 2 are rejected once `JWT_SECRET_PREVIOUS` is cleared.

---

### C. Database Credentials (`DATABASE_URL`, `DATABASE_PASSWORD`)

1. **Preparation**:
   * Create a secondary database user/password with identical role permissions in PostgreSQL.
2. **Deployment Sequence**:
   * Update application environment variables (`DATABASE_URL`) to use the new credentials.
   * Perform a zero-downtime rolling restart of all backend replicas.
   * Monitor DB connection pools (`pg_stat_activity`) to ensure all active connections migrate to the new user.
3. **Verification & Cleanup**:
   * Revoke and drop the old database role/password from PostgreSQL.

---

### D. Soroban Operator Secrets (`SOROBAN_OPERATOR_SECRET_KEY`)

1. **Preparation**:
   * Generate a new Stellar/Soroban keypair:
     ```bash
     stellar keys generate --global soroban-operator-new
     ```
   * Fund the new operator address on Stellar Mainnet/Testnet with adequate XLM for transaction gas fees.
2. **Deployment Sequence**:
   * Update smart contract operator authorization bindings if applicable.
   * Deploy environment variable `SOROBAN_OPERATOR_SECRET_KEY=<NEW_SECRET>` across background workers and API nodes.
   * Trigger a pod rollout restart.
3. **Verification**:
   * Submit a zero-value test transaction or claim action from the operator service.
   * Verify on-chain transaction status using Stellar Horizon/RPC.
   * Retire old operator account or sweep remaining XLM balance.

---

## 🔄 3. Rollback Procedure

If error rates spike (`> 1% 5xx errors`) or connection pools fail during rotation:

1. Revert environment variable settings to the previously cached vault secret version.
2. Trigger an immediate emergency deployment:
   ```bash
   kubectl rollout undo deployment/splitnaira-backend -n production