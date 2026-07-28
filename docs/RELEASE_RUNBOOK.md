## 📣 Soroban Event Schema Compatibility

Backend indexers and off-chain listeners rely on exact event topic structure and payload definitions.

### Pre-release Checklist:
1. Run contract event tests from the `contracts/` directory:
   ```bash
   cargo test --manifest-path contracts/Cargo.toml --lib events
   ```
2. Draft your release notes using the [Release Note Template](./RELEASE_NOTE_TEMPLATE.md).