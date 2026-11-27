# AgentQuest — On-chain Achievement Badges for Binance Agent ID Holders

Soulbound (ERC-5192) ERC-721 badges for Binance Agent ID (`.ai`) holders on BNB
Chain. Holders claim badges by proving, purely on-chain, that they hold NFTs
from a curated list of Agent ID ecosystem collections. No server, no voucher,
no oracle, no owner, no admin, no fees — claims are gas-only.

Built for the **Binance Agent ID Hackathon** (submission 18 Nov – 9 Dec 2026).
Contract: `AgentQuest Badge` / `AQBADGE`.

## Status

- ✅ **DEPLOYED to BNB Smart Chain mainnet, 18 Nov 2026 20:56 WIB.**
- ✅ Contract: [`0x26ad277193ff31bd086a47bf7b1d25a93573c989`](https://bscscan.com/address/0x26ad277193ff31bd086a47bf7b1d25a93573c989) — source verified on [BscScan](https://bscscan.com/address/0x26ad277193ff31bd086a47bf7b1d25a93573c989#code) and [Sourcify](https://sourcify.dev/#/lookup/0x26ad277193ff31bd086a47bf7b1d25a93573c989) (exact match, 18 Nov 2026).
- ✅ Deploy tx: [`0x6e93e640c613c427143181e18da912683939cec9621b65dbc5031cae54c9e9cf`](https://bscscan.com/tx/0x6e93e640c613c427143181e18da912683939cec9621b65dbc5031cae54c9e9cf) (block 134323139, deployer Account 16 `0xed1A29F81a61029089Ad8D641670baD47bDced3A`, 2,677,314 gas).
- ✅ Live app: https://zainumq.github.io/agentquest/
- ✅ Traction: live on the [status board](https://zainumq.github.io/agentquest/status.html) (badges and holders, read on-chain).
- ✅ Contract written, **31/31 forge tests pass** (incl. 1 fuzz test, 256 runs).
- ✅ Deploy script validated end-to-end on a local anvil chain before the mainnet deploy.

## Quests (v1)

| ID | Quest | Requirement (all require holding an Agent ID) |
|----|-------|-----------------------------------------------|
| 0 | Agent ID Holder | Hold a Binance Agent ID (`.ai`) |
| 1 | Collector I | Hold ≥ 3 NFTs from the curated list |
| 2 | Collector II | Hold ≥ 10 NFTs from the curated list |
| 3 | Collector III | Hold ≥ 25 NFTs from the curated list |

- One badge per quest per wallet (double-claim reverts).
- `claim(uint8 questId)` claims one badge; `claimAll()` claims every badge the
  caller is currently eligible for in a single transaction.
- `isEligible(questId, holder)` and `heldCount(holder)` are free view functions
  — **frontends must check eligibility off-chain first**: a reverted claim
  still costs gas (the eligibility scan reads up to 30 contracts).

## Curated list (30 contracts)

Derived 18 Nov 2026 from `radar-pending.json`: status `DONE-MINTED` /
`DONE-MINTED-PARALLEL` / `ALREADY-OWNED`, excluding `TOKEN` / `NON-NFT`,
supply 100–1,000,000, top 30 by minted count. Every entry's `balanceOf(address)`
was verified readable via `eth_call` against live BSC RPCs (36/36 OK, including
spares). Minted counts are the radar snapshot values at derivation time.

| # | Collection | Contract | Minted |
|---|-----------|----------|-------:|
| 1 | sidecoo Daily | `0x409Cfe3747f1ac20f267B50BCbB6a4E9406DA3a8` | 29,373 |
| 2 | Pilot Boarding Pass | `0xc267E47F1Ba3B6B2BCbA58f16298c92CaCAF7952` | 25,026 |
| 3 | Nemotron Sigil | `0xDd8BdfC91cbD572935B09863A742d8296fed0ACf` | 17,553 |
| 4 | LeadLoop | `0xe887584746A1375d732854b3B67460a2A73ae0a9` | 10,000 |
| 5 | HIRELINGS | `0x6b1D77D3DeDE3FC775ca8C7BDe08C2C2EAAb9BEA` | 10,000 |
| 6 | HashOre | `0x828e7073Ef57Ed778E4acF82cC45BC43eF760b54` | 10,000 |
| 7 | Binance Agent Oracle | `0xcBe2DBBFF4264Dc67Bf557c64e29997B82439354` | 9,202 |
| 8 | Agentlings | `0xBf3488E453c68e9771C26D448E99d0EC5395135f` | 8,851 |
| 9 | CactiCore | `0x6af0307E75B8153340E2723c1468a2412a160080` | 7,298 |
| 10 | Glyphora | `0x4c1A7eA2070f0ADF833e28d7FE8e1b8F62CF27F8` | 7,296 |
| 11 | MothWire | `0xd584D5CD6A28Af35f52aE90c4B436132858fc36D` | 7,164 |
| 12 | Tacotron | `0x05deBE4445232205AE7E79d02cb5DE5AA0641efF` | 7,008 |
| 13 | The Claf Eye | `0x1c759C4e075103b5B250DB5114B832b17B99C456` | 6,988 |
| 14 | Agent Miner | `0xCe67038f8703Dff3Aadaf77d41823b4b039C9446` | 6,403 |
| 15 | SYMBOL | `0x993C822E7d9bBC75aa6b5095bD90a011Ff38cF71` | 6,220 |
| 16 | Agent Cosmos | `0x3Aeda314ec05BC22E3c26a543E16Df2B8cC8fe69` | 5,349 |
| 17 | Voltoad | `0xbC95E0a5Bb1305958Ba3263C6E9943b7A2554757` | 5,195 |
| 18 | Agent Apes | `0xbF18B0CfDd9e4FD138a362A92F29674197Fdb886` | 5,126 |
| 19 | PassAgentX | `0x08b1A979Dd997492EEcc010fe986eA2e2925e620` | 5,100 |
| 20 | Kitesy | `0x8cc691D0EEf7870460e2886Aa1075bF3468710a2` | 4,206 |
| 21 | Ghostling | `0x6A4847Cb5f658943222FBd23D2520049F824789d` | 4,171 |
| 22 | AGENTONE Hero | `0x9B0c237A123277fCf8768550Bbdd7767C73Cf5D3` | 4,168 |
| 23 | Pixel Sentinels | `0x4e4e43f84E2E80716d03153F3c675e8E715Fa698` | 4,132 |
| 24 | Arcadion | `0x8d0f3FCdaec965120C53a753a456Ed85A6624aD3` | 3,563 |
| 25 | Peachling | `0xa340ba0FeAcBBD17cBb1622C4d33Ed32720E1F83` | 3,545 |
| 26 | Foxglow | `0x6E159c9CD56BeadB523B80d195DdE39C042a1D48` | 3,329 |
| 27 | Polar Bear | `0x4673c787Fb192285a7eCD69860503CA3e95bD765` | 3,320 |
| 28 | Dropnix | `0xB95531Eb859c556B7c9521a99B7b67BA12519564` | 3,227 |
| 29 | Bobaloo | `0x072109f54dCca581e45C6FF3516e6Af9BDcbdc60` | 3,216 |
| 30 | Jalopix | `0x04f3E2A5c4883c67F732Dff38DCA137F41122C62` | 3,134 |

**Exclusions / exceptions (documented):**

- **Agent404** (`0xb61b93704ae5c1d1d48cd97a18d78f23a4912b07`, 293,214) passed the
  mechanical filter but was **excluded**: it is an ERC20 token claim, not an NFT
  collection (`balanceOf(wallet)` = 303 tokens). Counting it would mislabel a
  token holding as an NFT collection held.
- **HashOre** (#6) was **included as a deliberate exception**: its radar status
  is `SOLD-OUT-OWNED`, so the strict status filter excluded it, but it is a
  legitimate sold-out NFT collection (10,000 minted) named as known-good in the
  build brief, and its `balanceOf` verified readable.
- Verified spares (not in the list, available as replacements): Plasmagent
  `0xa0e09358a022bff0a8dfbdead35fbf68b4daab08`, Glaciera
  `0x38850da344c7674470943a9091df1679f7e2a6d5`, Iridawn
  `0x6912ad805cb3e0fdd6330f27347193e4efc0742d`, Hotairo
  `0x68f1bca992c97849dc0dff2e7c769b0ebd175446`, Trumpeto
  `0x13e2400414e18046b250269dad7d1471b336273c`.

## Design decisions

1. **Agent ID gate via `balanceOf > 0` only.** The Agent ID registry
   (`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`) does **not** implement
   `totalSupply()` — it reverts on all tested RPCs. The contract never calls
   it. The registry address is passed to the constructor and stored
   `immutable`, so the gate can never be re-pointed (the deploy script passes
   the canonical address).
2. **Pure on-chain verification.** Eligibility is computed by reading
   `balanceOf` on the curated contracts directly. No server, no voucher, no
   oracle, no signature.
3. **Failure-tolerant reads.** Each curated `balanceOf` is wrapped in
   `try/catch`: if a curated contract ever stops answering, it counts as 0
   instead of bricking all claims. (The Agent ID gate itself is a direct call —
   a reverting registry should fail loud.)
4. **Early-exit counting.** The eligibility scan stops as soon as the threshold
   is reached (Collector I stops after 3 hits instead of scanning all 30).
5. **Soulbound (ERC-5192).** `locked(tokenId)` returns `true` for every badge
   (reverts for nonexistent tokens, per the EIP); `_update` reverts on anything
   but minting, so transfers *and* burns are blocked — badges are permanent.
   `approve` / `setApprovalForAll` always revert. `Locked` is emitted on mint.
   `supportsInterface(0xb45a3c0e)` is `true`.
6. **No owner / admin / pause / upgrade / withdraw.** The contract has no
   privileged functions at all. Quest config (Agent ID address + curated list)
   is set once in the constructor; the constructor rejects zero addresses,
   duplicates, and an empty list.
7. **Gas-only.** `claim` / `claimAll` are **not payable** — attaching any value
   reverts at the EVM level. There is no fee mechanism anywhere.
8. **Fully on-chain metadata.** `tokenURI` returns a `data:application/json`
   URI with an embedded base64 SVG (one colour per quest tier) — no IPFS or
   server dependency.
9. **Toolchain:** Solidity 0.8.24, OpenZeppelin Contracts v5.7.0, EVM version
   Cancun (required by OZ v5.7's use of `MCOPY`; BSC supports Cancun since the
   Haber hardfork, Jun 2024). Optimizer on, 200 runs.

## Test results

`forge test` — **31 passed, 0 failed** (incl. `testFuzzHeldCount`, 256 runs).

Coverage: constructor validation (zero agent / empty list / duplicates),
Agent ID gating (claim + claimAll revert without an Agent ID), each quest tier
eligible + ineligible (boundary cases 2/3, 9/10, 24/25), double-claim revert,
invalid quest revert, claim-with-value revert, soulbound
(transfer / safeTransfer / approve / setApprovalForAll revert),
`locked()` true + reverts for nonexistent tokens, ERC-5192 + ERC-721 interface
support, `claimAll` (mints all eligible, skips claimed), distinct-collection
counting (5 tokens in one collection = 1), broken-curated-contract tolerance
(reverting `balanceOf` counts as 0), and `tokenURI` content (base64-decoded in
the test: contains the quest name and the SVG data URI).

One advisory lint remains (`require-revert-in-loop` on the constructor's
duplicate check) — intentional one-time validation over a bounded 30-item list.

## Gas (measured with mocks; mainnet may vary ±10–20%)

From `forge test --gas-report` + a local anvil deployment run. Costs at BSC
gas price ~0.1 gwei (recent mainnet txs used 0.1–0.128 gwei); BNB ≈ $570 (rate assumption: 0.005 BNB ≈ $2.85).

| Operation | Gas | ≈ BNB @0.1 gwei | ≈ USD |
|---|---:|---:|---:|
| Deploy (10,375 bytes) | 2,677,314 | 0.000268 | ~$0.153 |
| `claim` quest 0 (est.) | ~100,000 | 0.000010 | ~$0.006 |
| `claim` Collector I (est.) | ~120,000 | 0.000012 | ~$0.007 |
| `claim` Collector II (est.) | ~170,000 | 0.000017 | ~$0.010 |
| `claim` Collector III (measured max) | 326,164 | 0.000033 | ~$0.019 |
| `claimAll` all 4 badges (measured max) | 509,025 | 0.000051 | ~$0.029 |
| `claim` range across tests | 21,236–326,164 (avg 138,617) | | |
| `heldCount` / `isEligible` / `tokenURI` | views (free off-chain) | | |

Per-quest estimates for quests 0–2 are derived from the measured Collector III
max (25 checks + mint) and the measured per-check cost (~8k gas incl. loop
overhead); Collector III and `claimAll` maxima are directly measured.

## Deployment (executed 18 Nov 2026)

Deployed to BNB Smart Chain mainnet on **18 Nov 2026 20:56 WIB** with the
deploy script at `script/DeployAgentQuest.s.sol` (previously validated
end-to-end on a local anvil chain: deploy succeeded, receipt status 1;
on-chain reads confirmed name `AgentQuest Badge`, symbol `AQBADGE`, canonical
Agent ID address, `curatedLength` 30, first/last curated addresses, ERC-5192
interface support, `QUEST_COUNT` 4).

- **Contract:** `0x26ad277193ff31bd086a47bf7b1d25a93573c989`
- **Deploy tx:** `0x6e93e640c613c427143181e18da912683939cec9621b65dbc5031cae54c9e9cf` (block 134323139, status 1)
- **Deployer:** Account 16 `0xed1A29F81a61029089Ad8D641670baD47bDced3A` (gas only — the contract has no owner)
- **Gas used:** 2,677,314 (matches the gas table below)
- **Verification:** source verified on BscScan + Sourcify (exact match) on 18 Nov 2026

The deploy was run with (record of the exact commands used):

```bash
# Dry run (no broadcast, no spend):
forge script script/DeployAgentQuest.s.sol --rpc-url https://bsc-dataseed.bnbchain.org

# Real deploy (funded deployer key + BscScan API key):
forge script script/DeployAgentQuest.s.sol \
  --rpc-url https://bsc-dataseed.bnbchain.org \
  --broadcast --private-key $DEPLOYER_PRIVATE_KEY \
  --verify --verifier-url https://api.bscscan.com/api \
  --etherscan-api-key $BSCSCAN_API_KEY
```

### Deploy-path finding: the baw CLI CANNOT deploy contracts

Checked the `binance-agentic-wallet` skill (v1.15.0) and `baw --help` (CLI
1.12.0): there is **no deploy command**. The closest command,
`contract-call preview`, **requires `--to`** (a target contract address), while
a contract-creation transaction has no `to` address — so deployment via baw is
not possible. The Agentic Wallet is keyless (no private key to hand to forge),
so deployment needs a **separate EOA key** funded with ~0.0003 BNB for gas
(`forge create` / `forge script --private-key`, command above). The deployer
key holds **no power** after deployment — the contract has no owner — its only
role is paying gas and being recorded as the deployer.

## Pre-deployment decisions — all resolved (archived)

These five decisions were open before deployment; all were answered in
Nov 2026 and are recorded here for the audit trail only.

1. **Deployer wallet**: Account 16 (`0xed1A29F81a61029089Ad8D641670baD47bDced3A`)
   funded and sent the deployment (2,677,314 gas). It holds no ongoing role
   afterwards — the contract has no owner.
2. **Curated list sign-off**: the 30 contracts above (incl. the HashOre
   exception and the Agent404 exclusion) were confirmed 18 Nov 2026 and are
   immutable in the deployed contract — verified on-chain 27 Nov 2026
   (`curatedLength()` = 30, all 30 addresses match).
3. **BscScan verification**: source verified on BscScan + Sourcify
   (exact match) on 18 Nov 2026.
4. **Frontend**: live at https://zainumq.github.io/agentquest/ since
   18 Nov 2026 (quest list + claim buttons, eligibility checked first).
5. **Timing**: deployed 18 Nov 2026 — well before submission closes
   9 Dec 2026 15:00 WIB, and the 30-interacting-holder bar was passed
   within a day (169 holders / 420 badges by 19 Nov 06:54 WIB).

## Commands

```bash
export TMPDIR=~/workspace/.tmp-foundry   # /tmp is a 512 MB tmpfs — never use it for foundry
forge build
forge test
forge test --gas-report
```
