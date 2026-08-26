# Contract Execution Cost Benchmarks & Scalability Guide

This document defines the resource cost models, benchmark measurement suite, and regression detection procedures for SplitNaira smart contracts on Soroban.

---

## 1. Overview

SplitNaira smart contracts execute royalty splits with support for up to:
- **50 Collaborators** (Default capacity, `DEFAULT_MAX_COLLABORATORS`)
- **200 Collaborators** (Configurable hard cap, `MAX_MAX_COLLABORATORS`)

To guarantee transaction reliability on Stellar mainnet and testnet, all execution paths must remain strictly within Soroban network resource limits (~100M CPU instructions, ~40MB memory per transaction budget).

---

## 2. Execution Path Complexity & Cost Models

| Path | Complexity | Description | Resource Consumption |
| :--- | :--- | :--- | :--- |
| **`deposit`** | $\mathcal{O}(1)$ | Transfers tokens into the contract and updates the internal project balance. | Constant (~200k CPU instructions, ~30k RAM bytes), independent of collaborator count. |
| **`distribute`** | $\mathcal{O}(N)$ | Push payout: iterates over all $N$ collaborators, calculates basis point allocations, transfers tokens, updates storage and emits events. | Scales linearly with collaborator count $N$. |
| **`claim`** | $\mathcal{O}(N)$ lookup / $\mathcal{O}(1)$ transfer | Pull payout: a single collaborator withdraws their individual allocation. | Low constant execution footprint (~350k–500k CPU instructions), independent of batch distribution size. |

---

## 3. Benchmark Measurement Suite

The automated benchmark suite is located in [`contracts/cost_benchmark_tests.rs`](file:///contracts/cost_benchmark_tests.rs).

### Running Benchmarks Locally

Maintainers can measure and print real-time budget usage using `cargo test`:

```bash
# Run cost benchmark suite with console output
cargo test --manifest-path contracts/Cargo.toml --features testutils cost_benchmark_tests -- --nocapture
```

### Benchmark Metrics Summary

| Execution Path | Collaborator Count | CPU Instructions (Approx.) | Memory Bytes (Approx.) | Soroban Budget Headroom |
| :--- | :--- | :--- | :--- | :--- |
| `deposit` | 2 | ~195,000 | ~28,000 | > 99% Headroom |
| `deposit` | 50 | ~195,000 | ~28,000 | > 99% Headroom |
| `deposit` | 200 | ~195,000 | ~28,000 | > 99% Headroom |
| `claim` (1 recipient) | 2 | ~240,000 | ~35,000 | > 99% Headroom |
| `claim` (1 recipient) | 50 | ~320,000 | ~48,000 | > 99% Headroom |
| `claim` (1 recipient) | 200 | ~490,000 | ~75,000 | > 99% Headroom |
| `distribute` | 2 | ~450,000 | ~65,000 | > 99% Headroom |
| `distribute` | 10 | ~1,200,000 | ~160,000 | > 98% Headroom |
| `distribute` | 50 (Default Max) | ~4,200,000 | ~520,000 | > 95% Headroom |
| `distribute` | 200 (Hard Cap Max) | ~16,500,000 | ~1,950,000 | > 80% Headroom |

---

## 4. Regression Ceilings & Automated Invariants

The benchmark suite asserts the following hard ceilings to catch regressions during CI/CD:

1. **50 Collaborators (`distribute`)**:
   - `cpu_instructions < 6,000,000`
   - `memory_bytes < 750,000`
2. **200 Collaborators (`distribute`)**:
   - `cpu_instructions < 25,000,000`
   - `memory_bytes < 3,000,000`
3. **`deposit` ($O(1)$)**:
   - `cpu_instructions < 350,000`
   - `memory_bytes < 50,000`
4. **`claim` (Single recipient)**:
   - `cpu_instructions < 800,000`
   - `memory_bytes < 150,000`

---

## 5. Architectural Recommendations for Large Splits

- For splits with $\le 50$ collaborators, the push `distribute` path is fast, cost-effective, and settles all recipients simultaneously in one ledger transaction.
- For extremely large splits ($\ge 100$ collaborators) or high-frequency distribution environments, users and dApps should favor the self-service **pull `claim`** path to minimize transaction footprint per operation.
