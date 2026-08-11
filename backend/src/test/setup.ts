process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "https://example.com/postgres";
process.env.HORIZON_URL = process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
process.env.SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
process.env.SOROBAN_NETWORK_PASSPHRASE =
  process.env.SOROBAN_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
process.env.CONTRACT_ID =
  process.env.CONTRACT_ID ?? "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
process.env.SIMULATOR_ACCOUNT = process.env.SIMULATOR_ACCOUNT ?? "GTESTSIMULATORACCOUNT";
process.env.MAINNET_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
process.env.RENDER_BACKEND_DEPLOY_HOOK_URL = "https://example.com/deploy";
