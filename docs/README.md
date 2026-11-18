# AgentQuest Frontend

Static single-page frontend for AgentQuest — on-chain achievement badges for
Binance Agent ID (`.ai`) holders on BNB Chain. Built for the Binance Agent ID
Hackathon (submission closes 9 Dec 2026).

No build step, no backend, no tracking, no API keys. Vanilla JS + ethers.js v6
(ESM, pinned CDN). All reads go through public BSC RPC endpoints; writes go
through the user's own wallet, one user-confirmed transaction per claim.

## Files

| File | What it is |
|---|---|
| `index.html` | Page structure (header, status cards, quests, badges, curated list, about) |
| `app.js` | All logic: wallet connect, network switch, eligibility reads, claims, badge rendering |
| `config.js` | Addresses, ABI, quest metadata, the 30 curated collections, RPC list |
| `styles.css` | Dark, minimal, mobile-friendly styling (no external assets) |

## Run locally

```bash
cd frontend
python3 -m http.server 8080
# open http://localhost:8080
```

Any static file server works. Opening `index.html` directly with `file://`
will **not** work — ES modules and the CDN import need `http(s)://`.

## After deploying the contract — the one-line change

In `config.js`, replace the placeholder:

```js
export const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
```

with the deployed contract address. That is the only change needed — quest
thresholds, colours, the curated list, and the Agent ID address are already
final and match `src/AgentQuest.sol` / `script/DeployAgentQuest.s.sol`.

Until that line is filled in, the page runs in "not deployed yet" mode: the
Agent ID status check works, but quest eligibility and claims stay disabled.

## Hosting options (not deployed — document only)

- **GitHub Pages**: push this `docs/` directory (or the repo with Pages
  pointed at it). Free, HTTPS by default, no build needed.
- **Cloudflare Pages**: drag-and-drop the `docs/` folder, or connect the
  repo with no build command and `docs/` as the output directory.
- Any static host works — there is no server-side code at all.

## How it works

### Reads (all free, no wallet signature needed)

| What the page shows | How it is read |
|---|---|
| Agent ID status | `balanceOf(wallet)` on the Agent ID registry `0x60b9…022f` (the registry has no `totalSupply()` — it reverts — so it is never called) |
| Collections held | `heldCount(wallet)` on AgentQuest — distinct curated collections with balance > 0 |
| Per-quest status | `isEligible(questId, wallet)` + `claimed(questId, wallet)` on AgentQuest. `isEligible` returns false for already-claimed quests, so `claimed()` is read separately to tell "claimed" from "not eligible" |
| Owned badges | Derived from per-quest `claimed()` (see below) |

Reads try the public RPC list in `config.js` in order until one answers, so a
single dead endpoint does not break the page.

### Claims (user-confirmed, gas-only)

1. The page re-checks `isEligible()` immediately before sending — on-page
   state can be stale, and a reverted claim still costs gas.
2. It dry-runs the claim with `staticCall` to catch a revert before any gas
   is spent.
3. The transaction is sent with **value 0** (the contract is not payable) and
   the user reviews and confirms it in their own wallet. Nothing is
   auto-signed.
4. On confirmation, the receipt's `Transfer` logs are parsed to learn each
   new badge's tokenId, which is cached in `localStorage` for the badges
   section.

`Claim all eligible` calls `claimAll()` — one transaction that mints every
badge the wallet is currently eligible for.

### Owned badges — why there is no enumeration

The contract deliberately has no `tokenOfOwnerByIndex` (no Enumerable
extension). Owned badges are therefore derived from per-quest `claimed()`
status, and each badge's tokenId is found in this order:

1. `localStorage` cache, recorded from the claim receipt when the badge was
   claimed through this page;
2. an `ownerOf()` scan over token ids `1..nextTokenId-1`, capped at 1,000
   tokens (`TOKEN_SCAN_CAP` in `config.js`);
3. if neither works, the badge is still shown from `claimed()` status, with a
   locally rendered preview (same SVG layout and colours as the contract)
   instead of the on-chain artwork.

When the tokenId is known, the artwork comes from the contract itself:
`tokenURI(tokenId)` returns a `data:application/json;base64` URI whose
`image` field is the on-chain SVG.

### What the contract lacks (frontend workarounds, all documented above)

- **No token enumeration** — worked around with the receipt cache +
  bounded `ownerOf()` scan. If total badges ever exceed the 1,000-token scan
  cap, badges claimed outside this page will show without their tokenId/SVG
  (still listed as owned, from `claimed()` status).
- **No per-wallet quest list view** — the frontend reads the 4 quests'
  `claimed()` / `isEligible()` individually (8 view calls per refresh; free).
- **No `totalSupply()` on the Agent ID registry** — the frontend never calls
  it; the Agent ID check is `balanceOf > 0` only, as the hackathon rules
  specify.

## Safety notes (hackathon red lines)

- No auto-signing, no session storage, no QR login — every transaction is
  confirmed by the user in their own wallet.
- No approvals are ever requested (`approve`/`setApprovalForAll` revert in
  the contract anyway — badges are soulbound).
- No token, no price, no promise of returns anywhere in the UI.
- The contract has no owner, admin, pause, upgrade, or withdraw function.
