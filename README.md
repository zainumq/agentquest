# AgentQuest

<p align="center"><img src="docs/kingkong-agent.jpg" alt="King Kong, the AgentQuest mascot — a gorilla dressed as a secret agent" width="320" /></p>

On-chain achievement badges for Binance Agent ID holders. Prove — purely
on-chain, with no server, no voucher, and no oracle — that you hold NFTs
across the Agent ID ecosystem, and claim soulbound badges for it.

Built for the **Binance Agent ID Hackathon** (Nov–Dec 2026).

- **Live app:** https://zainumq.github.io/agentquest/
- **Contract (BNB Chain):** [`0x26ad277193ff31bd086a47bf7b1d25a93573c989`](https://bscscan.com/address/0x26ad277193ff31bd086a47bf7b1d25a93573c989)
- **Source:** verified on [BscScan](https://bscscan.com/address/0x26ad277193ff31bd086a47bf7b1d25a93573c989#code) and [Sourcify](https://sourcify.dev/#/lookup/0x26ad277193ff31bd086a47bf7b1d25a93573c989) (exact match)

## How it works

Any wallet holding a Binance Agent ID (`.ai`) can claim badges. Eligibility
is verified by the contract itself at claim time, by reading `balanceOf` on
the Agent ID registry and on a curated list of 30 Agent ID ecosystem NFT
collections. Claims are gas-only — there are no fees, no owner, no admin, and
no upgrade path. The quest list is immutable.

| Quest | Requirement |
|---|---|
| Agent ID Holder | Hold a Binance Agent ID |
| Collector I | Hold NFTs from ≥ 3 curated collections |
| Collector II | Hold NFTs from ≥ 10 curated collections |
| Collector III | Hold NFTs from ≥ 25 curated collections |

Badges are soulbound ERC-721 tokens (ERC-5192): permanently locked to the
wallet that earned them. Metadata is a fully on-chain SVG — no IPFS, no
server. One badge per quest per wallet; `claimAll()` claims every badge you
are eligible for in a single transaction.

See [CONTRACT.md](CONTRACT.md) for the full contract reference, the curated
list, test results, and gas numbers.

## Claim a badge

1. Open the [live app](https://zainumq.github.io/agentquest/).
2. Connect a wallet holding a Binance Agent ID (BNB Smart Chain mainnet).
3. The app checks your eligibility off-chain first, so you never spend gas
   on a claim that would revert.
4. Claim a badge (or Claim All) and confirm the transaction in your wallet.

## Development

Foundry project. Requires [Foundry](https://book.getfoundry.sh/).

```bash
forge install           # dependencies (OpenZeppelin, forge-std)
forge build
forge test            # 31 tests, incl. fuzz
```

- `src/AgentQuest.sol` — the contract
- `test/AgentQuest.t.sol` — tests + mocks
- `script/DeployAgentQuest.s.sol` — deployment script (already deployed)
- `flattened/` — the flattened single-file source as verified on BscScan,
  plus the ABI-encoded constructor arguments
- `docs/` — the static frontend (also served by GitHub Pages)

## License

MIT. See [LICENSE](LICENSE).
