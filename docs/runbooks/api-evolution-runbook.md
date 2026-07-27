### 🔄 API Casing & Field Deprecation Guidelines

To prevent breaking mobile or legacy web clients during backend refactoring, follow these contract guarantees regarding payload casing:

1. **Dual-Casing Backward Compatibility**:
   * All API response payloads for `splits`/`projects` must support dual casing mapping (`camelCase` preferred, `snake_case` fallback).
   * Key field aliases (e.g., `target_amount` and `targetAmount`) must remain supported in shared contract mappers until a major version deprecation cycle.
2. **Contract Testing Requirement**:
   * Any change to split response serialisation must pass `src/contracts/__tests__/split-response-casing.contract.spec.ts`.
   * Endpoint tests for `GET /v1/splits`, `GET /v1/splits/:id`, `POST /v1/splits`, and `PATCH /v1/splits/:id` must validate both casing contract fixtures.