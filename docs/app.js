// AgentQuest frontend — vanilla JS + ethers.js v6.
//
// Reads go through public BSC RPC endpoints (with fallback). Writes go
// through the user's own wallet, and every claim is a transaction the user
// reviews and confirms themselves — nothing is ever auto-signed.
// Claims are value 0, gas only; the contract is not payable.

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.5/+esm";
import {
  CONTRACT_ADDRESS,
  AGENT_ID_ADDRESS,
  AGENTQUEST_ABI,
  AGENT_ID_ABI,
  STREAK_ADDRESS,
  STREAK_ABI,
  STREAK_MILESTONES,
  BSCSCAN_BASE,
  BSC_CHAIN_PARAMS,
  CHAIN_ID,
  CHAIN_ID_HEX,
  CURATED,
  QUESTS,
  RPC_URLS,
  TOKEN_SCAN_CAP,
  ZERO_ADDRESS,
} from "./config.js";

const $ = (id) => document.getElementById(id);
const isDeployed = CONTRACT_ADDRESS.toLowerCase() !== ZERO_ADDRESS.toLowerCase();
const shortAddress = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const bscscanTx = (hash) => `${BSCSCAN_BASE}/tx/${hash}`;
const bscscanToken = (tokenId) =>
  `${BSCSCAN_BASE}/token/${CONTRACT_ADDRESS}?a=${tokenId}`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let walletProvider = null; // ethers.BrowserProvider (user's wallet)
let signer = null;
let account = null; // checksummed address
let walletChainId = null;
let busy = false; // a claim transaction is in flight

// Live per-wallet status, refreshed from the chain.
const status = {
  hasAgentId: null, // boolean | null (unknown)
  held: null, // number of distinct curated collections held | null
  quests: QUESTS.map(() => ({ claimed: false, eligible: false })),
  // Daily check-in streak (null fields = unknown, not yet read).
  streak: {
    current: null, // consecutive-day streak | null
    total: null, // cumulative check-ins (never resets) | null
    checkedInToday: null, // boolean | null
    claimed: STREAK_MILESTONES.map(() => false), // milestone badge per threshold
  },
};

// Read-only providers, tried in order until one answers.
const readProviders = RPC_URLS.map((url) => new ethers.JsonRpcProvider(url, CHAIN_ID));

function readContract(provider) {
  return new ethers.Contract(CONTRACT_ADDRESS, AGENTQUEST_ABI, provider);
}

function agentIdContract(provider) {
  return new ethers.Contract(AGENT_ID_ADDRESS, AGENT_ID_ABI, provider);
}

function readStreakContract(provider) {
  return new ethers.Contract(STREAK_ADDRESS, STREAK_ABI, provider);
}

/** Run `fn(provider)` against read providers in order; first success wins. */
async function withReadProvider(fn) {
  let lastError = null;
  for (const provider of readProviders) {
    try {
      return await fn(provider);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("All BSC RPC endpoints failed.");
}

// ---------------------------------------------------------------------------
// Small UI helpers (all dynamic text goes through textContent, never
// innerHTML with untrusted data)
// ---------------------------------------------------------------------------

function showError(message) {
  const el = $("error-banner");
  el.textContent = message;
  el.hidden = false;
}

function clearError() {
  $("error-banner").hidden = true;
}

function renderTxLines(box, lines) {
  // lines: array of { text } or { text, href } segments grouped per <p>.
  box.replaceChildren();
  for (const line of lines) {
    const p = document.createElement("p");
    for (const seg of line) {
      if (seg.href) {
        const a = document.createElement("a");
        a.href = seg.href;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = seg.text;
        p.appendChild(a);
      } else {
        p.appendChild(document.createTextNode(seg.text));
      }
    }
    box.appendChild(p);
  }
  box.hidden = false;
}

function setTxStatus(lines) {
  renderTxLines($("tx-status"), lines);
}

function clearTxStatus() {
  $("tx-status").hidden = true;
  $("tx-status").replaceChildren();
}

// The check-in section has its own status box, so check-in messages never
// collide with claim messages.
function setStreakTxStatus(lines) {
  renderTxLines($("streak-tx-status"), lines);
}

function clearStreakTxStatus() {
  $("streak-tx-status").hidden = true;
  $("streak-tx-status").replaceChildren();
}

// ---------------------------------------------------------------------------
// Wallet connection & network
// ---------------------------------------------------------------------------

async function connectWallet() {
  if (!window.ethereum) {
    showError(
      "No wallet found. Install MetaMask or Binance Wallet, then reload this page."
    );
    return;
  }
  clearError();
  try {
    walletProvider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await walletProvider.send("eth_requestAccounts", []);
    if (accounts.length === 0) return;
    account = ethers.getAddress(accounts[0]);
    signer = await walletProvider.getSigner();
    const network = await walletProvider.getNetwork();
    walletChainId = Number(network.chainId);
    updateWalletUI();
    await refreshAll();
  } catch (err) {
    showError(friendlyError(err));
  }
}

function disconnectWallet() {
  walletProvider = null;
  signer = null;
  account = null;
  walletChainId = null;
  status.hasAgentId = null;
  status.held = null;
  status.quests = QUESTS.map(() => ({ claimed: false, eligible: false }));
  status.streak = {
    current: null,
    total: null,
    checkedInToday: null,
    claimed: STREAK_MILESTONES.map(() => false),
  };
  clearError();
  clearTxStatus();
  clearStreakTxStatus();
  updateWalletUI();
  renderAgentId();
  renderHeld();
  renderKongBenefits();
  renderStreak();
  renderQuests();
  renderBadgesEmpty("Connect your wallet to see your badges.");
}

function updateWalletUI() {
  const btn = $("connect-btn");
  const label = $("account-label");
  if (account) {
    btn.textContent = "Disconnect";
    btn.classList.remove("btn-primary");
    label.textContent = shortAddress(account);
    label.hidden = false;
  } else {
    btn.textContent = "Connect wallet";
    btn.classList.add("btn-primary");
    label.hidden = true;
  }
  updateNetworkUI();
  renderLeaderboard(); // re-highlights (or clears) the connected wallet's row
}

function updateNetworkUI() {
  const pill = $("network-pill");
  const warning = $("network-warning");
  if (walletChainId === null) {
    pill.hidden = true;
    warning.hidden = true;
    return;
  }
  pill.hidden = false;
  if (walletChainId === CHAIN_ID) {
    pill.textContent = "BSC · Chain 56";
    pill.className = "pill pill-ok";
    warning.hidden = true;
  } else {
    pill.textContent = `Wrong network (chain ${walletChainId})`;
    pill.className = "pill pill-warn";
    warning.hidden = false;
  }
}

async function switchToBsc() {
  clearError();
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err) {
    // 4902: chain not added to the wallet yet — ask to add it.
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [BSC_CHAIN_PARAMS],
      });
    } else {
      throw err;
    }
  }
  // The chainChanged listener refreshes state after the switch.
}

/** Make sure the wallet is on BSC before a claim; prompts the user to switch. */
async function ensureBsc() {
  if (walletChainId === CHAIN_ID) return;
  await switchToBsc();
  // Re-read the chain: the listener may not have fired yet.
  const network = await walletProvider.getNetwork();
  walletChainId = Number(network.chainId);
  updateNetworkUI();
  if (walletChainId !== CHAIN_ID) {
    throw new Error("WRONG_NETWORK");
  }
}

// ---------------------------------------------------------------------------
// Chain reads: Agent ID status, held count, per-quest eligibility
// ---------------------------------------------------------------------------

async function refreshAll() {
  if (!account) return;
  clearError();

  // 1. Agent ID gate — balanceOf > 0 on the registry. This works even before
  // the AgentQuest contract is deployed.
  try {
    const bal = await withReadProvider((p) => agentIdContract(p).balanceOf(account));
    status.hasAgentId = bal > 0n;
  } catch {
    showError(
      "Could not reach BNB Chain to check your Agent ID. Check your connection and try again."
    );
    status.hasAgentId = null;
  }
  renderAgentId();

  if (!isDeployed) {
    renderHeld();
    renderQuests();
    renderStreak();
    renderBadgesEmpty("The contract is not deployed yet — no badges exist.");
    return;
  }

  // 2. Sanity check: the deployed contract must point at the canonical
  // Agent ID registry. If it does not, something is wrong — say so loudly.
  try {
    const onChainAgentId = await withReadProvider((p) => readContract(p).agentId());
    if (onChainAgentId.toLowerCase() !== AGENT_ID_ADDRESS.toLowerCase()) {
      showError(
        "Warning: this contract points at a different Agent ID registry than the canonical one. Claims are disabled."
      );
      renderHeld();
      renderQuests();
      renderStreak();
      renderBadgesEmpty("Contract configuration mismatch — see the warning above.");
      return;
    }
  } catch {
    // agentId() is a trivial view; a failure here means RPC trouble, which
    // the reads below will surface. Continue.
  }

  // 3. Held count + per-quest claimed / eligible status, in parallel.
  // isEligible() already returns false for claimed quests, so claimed() is
  // read separately to tell "claimed" apart from "not eligible".
  try {
    const [held, perQuest] = await Promise.all([
      withReadProvider((p) => readContract(p).heldCount(account)),
      Promise.all(
        QUESTS.map(async (q) => ({
          claimed: await withReadProvider((p) => readContract(p).claimed(q.id, account)),
          eligible: await withReadProvider((p) => readContract(p).isEligible(q.id, account)),
        }))
      ),
    ]);
    status.held = Number(held);
    status.quests = perQuest;
  } catch {
    showError(
      "Could not read quest status from BNB Chain. Check your connection and try again."
    );
    status.held = null;
    status.quests = QUESTS.map(() => ({ claimed: false, eligible: false }));
  }

  renderHeld();
  renderQuests();
  await renderBadges();
  renderKongBenefits();
  await refreshStreak();
}

function renderAgentId() {
  const el = $("agent-id-status");
  if (!account) {
    el.textContent = "Connect your wallet to check.";
    el.className = "big-status status-muted";
    return;
  }
  if (status.hasAgentId === null) {
    el.textContent = "Could not check — RPC unreachable.";
    el.className = "big-status status-warn";
    return;
  }
  if (status.hasAgentId) {
    el.textContent = "✓ Agent ID held";
    el.className = "big-status status-ok";
  } else {
    el.textContent = "✗ No Agent ID in this wallet";
    el.className = "big-status status-bad";
  }
}

function renderHeld() {
  const el = $("held-status");
  const bar = $("held-bar");
  const note = $("held-note");
  if (!isDeployed || status.held === null) {
    el.textContent = "—";
    el.className = "big-status status-muted";
    bar.style.width = "0%";
    note.textContent = isDeployed
      ? "Distinct curated collections this wallet holds at least one NFT of."
      : "Available after the contract is deployed.";
    return;
  }
  el.textContent = `${status.held} / ${CURATED.length} collections`;
  el.className = "big-status";
  const maxThreshold = Math.max(...QUESTS.map((q) => q.threshold ?? 0));
  bar.style.width = `${Math.min(100, (status.held / maxThreshold) * 100)}%`;
  note.textContent =
    status.held >= maxThreshold
      ? "You hold NFTs from enough curated collections for every Collector quest."
      : "Distinct curated collections this wallet holds at least one NFT of.";
}

function renderKongBenefits() {
  const pill = $("kong-pill");
  const statusEl = $("kong-status");
  if (!account) {
    pill.textContent = "Connect your wallet to check your badges.";
    pill.className = "pill pill-muted";
    statusEl.textContent = "Connect your wallet to see your badges.";
    return;
  }
  const count = status.quests.filter((q) => q.claimed).length;
  if (count === 0) {
    pill.textContent = "0 of 4 badges";
    pill.className = "pill pill-warn";
    statusEl.textContent =
      "You hold no badges yet — claim a quest below to unlock the $KONG airdrop and buyer bonus.";
  } else {
    pill.textContent = `✓ ${count} of 4 badges`;
    pill.className = "pill pill-ok";
    statusEl.textContent =
      count === 4
        ? "You hold all 4 badges — maximum airdrop share, and the +20% buyer bonus when you buy $KONG shares."
        : `You hold ${count} of 4 badges — you're eligible for the $KONG airdrop and the +20% buyer bonus. Claim the rest to grow your share.`;
  }
}

// ---------------------------------------------------------------------------
// Daily check-in (AgentQuestStreak companion contract)
// ---------------------------------------------------------------------------

function badgeCount() {
  return status.quests.filter((q) => q.claimed).length;
}

function resetStreakStatus() {
  status.streak = {
    current: null,
    total: null,
    checkedInToday: null,
    claimed: STREAK_MILESTONES.map(() => false),
  };
}

async function refreshStreak() {
  if (!account) return;
  if (!isDeployed) {
    renderStreak();
    return;
  }

  // Sanity check: the streak contract must point at this AgentQuest contract
  // and the canonical Agent ID registry. If it does not, something is wrong.
  try {
    const [onChainQuest, onChainAgentId] = await Promise.all([
      withReadProvider((p) => readStreakContract(p).agentQuest()),
      withReadProvider((p) => readStreakContract(p).agentId()),
    ]);
    if (
      onChainQuest.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase() ||
      onChainAgentId.toLowerCase() !== AGENT_ID_ADDRESS.toLowerCase()
    ) {
      showError(
        "Warning: the check-in contract points at different contracts than expected. Check-in is disabled."
      );
      resetStreakStatus();
      renderStreak();
      return;
    }
  } catch {
    // A failure here means RPC trouble, which the reads below will surface.
  }

  try {
    const [current, total, checkedIn, claimed] = await Promise.all([
      withReadProvider((p) => readStreakContract(p).streak(account)),
      withReadProvider((p) => readStreakContract(p).totalCheckins(account)),
      withReadProvider((p) => readStreakContract(p).hasCheckedInToday(account)),
      Promise.all(
        STREAK_MILESTONES.map((m) =>
          withReadProvider((p) => readStreakContract(p).milestoneClaimed(account, m.day))
        )
      ),
    ]);
    status.streak = {
      current: Number(current),
      total: Number(total),
      checkedInToday: checkedIn,
      claimed,
    };
  } catch {
    resetStreakStatus();
  }
  renderStreak();
}

function renderStreak() {
  const pill = $("streak-pill");
  const currentEl = $("streak-current");
  const totalEl = $("streak-total");
  const todayEl = $("streak-today");
  const statusEl = $("streak-status");
  const btn = $("checkin-btn");
  const noBadge = $("streak-no-badge");
  const list = $("streak-milestones");

  const setUnknown = () => {
    currentEl.textContent = "—";
    currentEl.className = "big-status status-muted";
    totalEl.textContent = "—";
    totalEl.className = "big-status status-muted";
    todayEl.textContent = "—";
    todayEl.className = "big-status status-muted";
  };

  // Milestone list — always rendered; claimed state comes from status.
  list.replaceChildren();
  for (let i = 0; i < STREAK_MILESTONES.length; i++) {
    const m = STREAK_MILESTONES[i];
    const li = document.createElement("li");
    const label = document.createElement("span");
    const dot = document.createElement("span");
    dot.className = "milestone-dot";
    dot.style.background = m.color;
    label.appendChild(dot);
    label.appendChild(document.createTextNode(`${m.name} — ${m.day}-day streak`));
    li.appendChild(label);
    const milestonePill = document.createElement("span");
    const claimed = status.streak.claimed[i];
    milestonePill.className = `pill ${claimed ? "pill-ok" : "pill-muted"}`;
    milestonePill.textContent = claimed ? "✓ Claimed" : "Not earned yet";
    li.appendChild(milestonePill);
    list.appendChild(li);
  }

  if (!account) {
    pill.textContent = "Connect your wallet to check your streak.";
    pill.className = "pill pill-muted";
    setUnknown();
    statusEl.textContent = "Connect your wallet to see your streak.";
    btn.disabled = true;
    btn.textContent = "Check in";
    btn.hidden = false;
    noBadge.hidden = true;
    return;
  }

  if (!isDeployed) {
    pill.textContent = "Not deployed yet";
    pill.className = "pill pill-muted";
    setUnknown();
    statusEl.textContent = "Available after the contract is deployed.";
    btn.disabled = true;
    btn.hidden = false;
    noBadge.hidden = true;
    return;
  }

  const s = status.streak;
  if (s.current === null) {
    pill.textContent = "Could not check — RPC unreachable.";
    pill.className = "pill pill-warn";
    setUnknown();
    statusEl.textContent = "Could not read streak status from BNB Chain.";
    btn.disabled = true;
    btn.hidden = false;
    noBadge.hidden = true;
    return;
  }

  currentEl.textContent = `${s.current} day${s.current === 1 ? "" : "s"}`;
  currentEl.className = "big-status";
  totalEl.textContent = String(s.total);
  totalEl.className = "big-status";
  if (s.checkedInToday) {
    todayEl.textContent = "✓ Checked in";
    todayEl.className = "big-status status-ok";
  } else {
    todayEl.textContent = "Not yet";
    todayEl.className = "big-status status-warn";
  }

  // Check-in needs at least one AgentQuest badge — the button becomes a
  // pointer to the quests below instead.
  if (badgeCount() === 0) {
    pill.textContent = "Needs a badge";
    pill.className = "pill pill-warn";
    statusEl.textContent = "Check-in unlocks once you hold an AgentQuest badge.";
    btn.hidden = true;
    noBadge.hidden = false;
    return;
  }
  noBadge.hidden = true;
  btn.hidden = false;

  if (s.checkedInToday) {
    pill.textContent = `✓ Checked in — streak ${s.current}`;
    pill.className = "pill pill-ok";
    statusEl.textContent =
      "You're checked in for today. Come back tomorrow (UTC) to keep the streak going.";
    btn.disabled = true;
    btn.textContent = "Checked in ✓";
    return;
  }

  pill.textContent = `Streak ${s.current} · ${s.total} total check-ins`;
  pill.className = "pill pill-muted";
  const next = STREAK_MILESTONES.find((m, i) => !s.claimed[i] && m.day > s.current);
  statusEl.textContent = next
    ? `Check in now to reach streak ${s.current + 1}. Next milestone: the ${next.name} badge at a ${next.day}-day streak.`
    : "Check in now to grow your streak and your share of the KONG streak pool.";
  btn.disabled = busy;
  btn.textContent = "Check in";
}

function streakWriteContract() {
  return new ethers.Contract(STREAK_ADDRESS, STREAK_ABI, signer);
}

async function checkIn() {
  if (busy || !account) return;
  setBusy(true);
  clearStreakTxStatus();
  try {
    await ensureBsc();
    const write = streakWriteContract();
    // Fresh check right before sending — the on-page state may be stale,
    // and a reverted check-in still costs gas.
    const already = await withReadProvider((p) =>
      readStreakContract(p).hasCheckedInToday(account)
    );
    if (already) throw new Error("ALREADY_CHECKED_IN");
    // Dry run against the wallet's own node: catches a revert before any
    // gas is spent.
    await write.checkIn.staticCall();
    const tx = await write.checkIn();
    setStreakTxStatus([
      [{ text: "Checking in… waiting for confirmation. " }],
      [{ text: "Transaction: " }, { text: shortAddress(tx.hash), href: bscscanTx(tx.hash) }],
    ]);
    const receipt = await tx.wait(1);
    // Did this check-in mint a milestone badge?
    let milestone = null;
    const iface = new ethers.Interface(STREAK_ABI);
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== STREAK_ADDRESS.toLowerCase()) continue;
      let parsed = null;
      try {
        parsed = iface.parseLog(log);
      } catch {
        continue;
      }
      if (
        parsed &&
        parsed.name === "MilestoneMinted" &&
        parsed.args.user.toLowerCase() === account.toLowerCase()
      ) {
        milestone = Number(parsed.args.milestone);
      }
    }
    setStreakTxStatus([
      [
        {
          text: milestone
            ? `✓ Checked in — you earned the ${milestone}-Day Streak badge! `
            : "✓ Checked in. ",
        },
      ],
      [{ text: "Transaction: " }, { text: shortAddress(tx.hash), href: bscscanTx(tx.hash) }],
    ]);
    await refreshAll();
  } catch (err) {
    setStreakTxStatus([[{ text: `✗ Check-in failed: ${friendlyError(err)}` }]]);
  } finally {
    setBusy(false);
  }
}

// ---------------------------------------------------------------------------
// Check-in leaderboard (data snapshot generated off-chain, see
// ../agentquest-leaderboard.py — the page never needs a wallet for this)
// ---------------------------------------------------------------------------

const LEADERBOARD_URL = "./leaderboard.json";
const LEADERBOARD_TOP_N = 20;
// Pool-price estimate only (12,600 USDT / 250,000,000 KONG at graduation);
// KONG has no market price until the sale graduates.
const KONG_IDR_ESTIMATE = 0.92;

let leaderboardData = null; // parsed leaderboard.json | null (not loaded / failed)

async function loadLeaderboard() {
  try {
    const res = await fetch(LEADERBOARD_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.entries)) throw new Error("bad leaderboard data");
    leaderboardData = data;
  } catch {
    leaderboardData = null;
  }
  renderLeaderboard();
}

function renderLeaderboard() {
  const pill = $("leaderboard-pill");
  const meta = $("leaderboard-meta");
  const table = $("leaderboard-table");
  const body = $("leaderboard-body");
  const youEl = $("leaderboard-you");
  const updatedEl = $("leaderboard-updated");

  youEl.hidden = true;
  youEl.replaceChildren();

  if (leaderboardData === null) {
    pill.textContent = "Unavailable";
    pill.className = "pill pill-warn";
    meta.textContent =
      "Could not load the leaderboard right now. Your check-ins are safe on-chain — try reloading the page.";
    table.hidden = true;
    body.replaceChildren();
    updatedEl.textContent = "—";
    return;
  }

  const entries = leaderboardData.entries.slice(0, LEADERBOARD_TOP_N);
  const totalCheckers = leaderboardData.total_checkers ?? entries.length;
  const totalDays = leaderboardData.total_days ?? 0;

  pill.textContent = `${totalCheckers} checker${totalCheckers === 1 ? "" : "s"} · ${totalDays} total days`;
  pill.className = "pill pill-muted";
  meta.textContent =
    totalCheckers === 0
      ? "No check-ins yet — be the first to check in and top this board."
      : `Top ${entries.length} of ${totalCheckers} checkers, by total check-in days.`;
  updatedEl.textContent = leaderboardData.generated_at_wib ?? "—";

  body.replaceChildren();
  table.hidden = entries.length === 0;

  const youLower = account ? account.toLowerCase() : null;
  let youEntry = null;

  for (const e of entries) {
    const row = document.createElement("tr");
    if (youLower && e.address.toLowerCase() === youLower) {
      row.className = "row-you";
      youEntry = e;
    }

    const rank = document.createElement("td");
    rank.textContent = `#${e.rank}`;
    row.appendChild(rank);

    const wallet = document.createElement("td");
    const link = document.createElement("a");
    link.href = `${BSCSCAN_BASE}/address/${e.address}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "mono";
    link.textContent = shortAddress(e.address);
    wallet.appendChild(link);
    row.appendChild(wallet);

    const days = document.createElement("td");
    days.className = "num";
    days.textContent = String(e.total_days);
    row.appendChild(days);

    const streak = document.createElement("td");
    streak.className = "num";
    streak.textContent = String(e.streak);
    row.appendChild(streak);

    const ms = document.createElement("td");
    if (e.milestones.length === 0) {
      ms.textContent = "—";
    } else {
      for (const day of e.milestones) {
        const m = STREAK_MILESTONES.find((x) => x.day === day);
        const chip = document.createElement("span");
        chip.className = "ms-badge";
        chip.style.setProperty("--ms-color", m ? m.color : "#9aa4b2");
        chip.textContent = `${day}d`;
        ms.appendChild(chip);
      }
    }
    row.appendChild(ms);

    const share = document.createElement("td");
    share.className = "num";
    const idr = Math.round((e.est_kong ?? 0) * KONG_IDR_ESTIMATE);
    share.textContent =
      `≈ ${(e.est_kong ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} KONG` +
      ` (≈ Rp${idr.toLocaleString("en-US")})`;
    row.appendChild(share);

    body.appendChild(row);
  }

  // Personal line for the connected wallet.
  if (youLower) {
    youEl.hidden = false;
    if (youEntry) {
      const idr = Math.round((youEntry.est_kong ?? 0) * KONG_IDR_ESTIMATE);
      youEl.textContent =
        `You are ranked #${youEntry.rank} with ${youEntry.total_days} total check-in day${youEntry.total_days === 1 ? "" : "s"} ` +
        `(est. share ≈ ${youEntry.est_kong.toLocaleString("en-US", { maximumFractionDigits: 0 })} KONG, ≈ Rp${idr.toLocaleString("en-US")}). ` +
        "Check in daily to climb higher.";
    } else if (leaderboardData.entries.some((e) => e.address.toLowerCase() === youLower)) {
      const full = leaderboardData.entries.find((e) => e.address.toLowerCase() === youLower);
      youEl.textContent =
        `You are ranked #${full.rank} with ${full.total_days} total check-in day${full.total_days === 1 ? "" : "s"} — just outside the top ${LEADERBOARD_TOP_N} shown here.`;
    } else {
      const link = document.createElement("a");
      link.href = "#streak-section";
      link.textContent = "check in";
      youEl.appendChild(document.createTextNode("You haven't checked in yet — "));
      youEl.appendChild(link);
      youEl.appendChild(
        document.createTextNode(" daily to join the leaderboard and grow your share of the 3,000,000 KONG pool.")
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

function questState(quest) {
  if (!account) return { label: "Connect wallet", pill: "pill-muted", canClaim: false };
  if (!isDeployed) return { label: "Not deployed yet", pill: "pill-muted", canClaim: false };
  const s = status.quests[quest.id];
  if (s.claimed) return { label: "✓ Claimed", pill: "pill-ok", canClaim: false };
  if (status.hasAgentId === false) {
    return { label: "Requires an Agent ID", pill: "pill-bad", canClaim: false };
  }
  if (status.hasAgentId === null || status.held === null) {
    return { label: "Checking…", pill: "pill-muted", canClaim: false };
  }
  if (s.eligible) return { label: "Eligible — ready to claim", pill: "pill-ok", canClaim: true };
  return { label: "Not eligible yet", pill: "pill-warn", canClaim: false };
}

function renderQuests() {
  const list = $("quest-list");
  list.replaceChildren();

  if (!account) {
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = "Connect your wallet to see your quests.";
    list.appendChild(p);
    updateClaimAllButton();
    return;
  }

  for (const quest of QUESTS) {
    const st = questState(quest);
    const card = document.createElement("article");
    card.className = "quest-card";
    card.style.setProperty("--quest-color", quest.color);

    const title = document.createElement("h3");
    title.textContent = quest.name;
    card.appendChild(title);

    const tagline = document.createElement("p");
    tagline.className = "quest-tagline";
    tagline.textContent = quest.tagline;
    card.appendChild(tagline);

    const req = document.createElement("p");
    req.className = "quest-req";
    req.textContent = quest.requirement;
    card.appendChild(req);

    if (quest.threshold !== null && status.held !== null) {
      const prog = document.createElement("p");
      prog.className = "quest-progress";
      prog.textContent = `Progress: ${Math.min(status.held, quest.threshold)} / ${quest.threshold} collections`;
      card.appendChild(prog);
    }

    const row = document.createElement("div");
    row.className = "quest-status";
    const pill = document.createElement("span");
    pill.className = `pill ${st.pill}`;
    pill.textContent = st.label;
    row.appendChild(pill);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary btn-small";
    btn.textContent = "Claim badge";
    btn.disabled = !st.canClaim || busy;
    btn.addEventListener("click", () => claimQuest(quest.id));
    row.appendChild(btn);

    card.appendChild(row);
    list.appendChild(card);
  }

  updateClaimAllButton();
}

function updateClaimAllButton() {
  const btn = $("claim-all-btn");
  const eligibleCount = isDeployed
    ? status.quests.filter((s) => s.eligible).length
    : 0;
  btn.disabled = eligibleCount === 0 || busy || !account;
  btn.textContent =
    eligibleCount > 0 ? `Claim all eligible (${eligibleCount})` : "Claim all eligible";
}

function setBusy(value) {
  busy = value;
  renderQuests(); // re-renders buttons in their enabled/disabled state
  renderStreak(); // the check-in button follows the same busy state
}

// ---------------------------------------------------------------------------
// Claims (each one is a user-confirmed wallet transaction, value 0)
// ---------------------------------------------------------------------------

function writeContract() {
  return new ethers.Contract(CONTRACT_ADDRESS, AGENTQUEST_ABI, signer);
}

async function claimQuest(questId) {
  if (busy || !account) return;
  const quest = QUESTS[questId];
  setBusy(true);
  clearTxStatus();
  try {
    await ensureBsc();
    const write = writeContract();
    // Fresh eligibility check right before sending — the on-page state
    // may be stale, and a reverted claim still costs gas.
    const ok = await withReadProvider((p) => readContract(p).isEligible(questId, account));
    if (!ok) throw new Error("NOT_ELIGIBLE_NOW");
    // Dry run against the wallet's own node: catches a revert before any
    // gas is spent.
    await write.claim.staticCall(questId);
    const tx = await write.claim(questId);
    setTxStatus([
      [{ text: `Claiming "${quest.name}"… waiting for confirmation. ` }],
      [{ text: "Transaction: " }, { text: shortAddress(tx.hash), href: bscscanTx(tx.hash) }],
    ]);
    const receipt = await tx.wait(1);
    await cacheTokenIdsFromReceipt(receipt);
    setTxStatus([
      [{ text: `✓ "${quest.name}" badge claimed. ` }],
      [{ text: "Transaction: " }, { text: shortAddress(tx.hash), href: bscscanTx(tx.hash) }],
    ]);
    await refreshAll();
  } catch (err) {
    setTxStatus([[{ text: `✗ Claim failed: ${friendlyError(err)}` }]]);
  } finally {
    setBusy(false);
  }
}

async function claimAllQuests() {
  if (busy || !account) return;
  setBusy(true);
  clearTxStatus();
  try {
    await ensureBsc();
    const write = writeContract();
    const eligibleIds = QUESTS.filter((q) => status.quests[q.id].eligible).map((q) => q.id);
    if (eligibleIds.length === 0) throw new Error("NOT_ELIGIBLE_NOW");
    await write.claimAll.staticCall();
    const tx = await write.claimAll();
    setTxStatus([
      [{ text: `Claiming ${eligibleIds.length} badge(s) in one transaction… waiting for confirmation. ` }],
      [{ text: "Transaction: " }, { text: shortAddress(tx.hash), href: bscscanTx(tx.hash) }],
    ]);
    const receipt = await tx.wait(1);
    await cacheTokenIdsFromReceipt(receipt);
    setTxStatus([
      [{ text: "✓ Badges claimed. " }],
      [{ text: "Transaction: " }, { text: shortAddress(tx.hash), href: bscscanTx(tx.hash) }],
    ]);
    await refreshAll();
  } catch (err) {
    setTxStatus([[{ text: `✗ Claim failed: ${friendlyError(err)}` }]]);
  } finally {
    setBusy(false);
  }
}

// ---------------------------------------------------------------------------
// Owned badges
// ---------------------------------------------------------------------------
//
// The contract has no token enumeration, so owned badges are derived from
// per-quest claimed() status. A badge's tokenId is found in this order:
//   1. localStorage — recorded from the claim receipt when claimed here;
//   2. an ownerOf() scan over 1..nextTokenId-1 (capped, see config);
//   3. if neither works, the badge is still shown from claimed() status,
//      with a locally rendered preview instead of the on-chain SVG.

const tokenIdKey = (questId) => `agentquest:token:${account.toLowerCase()}:${questId}`;

function loadTokenId(questId) {
  try {
    return window.localStorage.getItem(tokenIdKey(questId));
  } catch {
    return null;
  }
}

function saveTokenId(questId, tokenId) {
  try {
    window.localStorage.setItem(tokenIdKey(questId), String(tokenId));
  } catch {
    // Private mode etc. — the ownerOf scan is the fallback.
  }
}

async function cacheTokenIdsFromReceipt(receipt) {
  const iface = new ethers.Interface(AGENTQUEST_ABI);
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue;
    let parsed = null;
    try {
      parsed = iface.parseLog(log);
    } catch {
      continue;
    }
    if (!parsed || parsed.name !== "Transfer") continue;
    if (parsed.args.from !== ethers.ZeroAddress) continue; // mint only
    if (parsed.args.to.toLowerCase() !== account.toLowerCase()) continue;
    const tokenId = parsed.args.tokenId;
    try {
      const questId = Number(
        await withReadProvider((p) => readContract(p).tokenQuest(tokenId))
      );
      saveTokenId(questId, tokenId.toString());
    } catch {
      // Non-fatal: the badge still shows up via the ownerOf scan.
    }
  }
}

async function findOwnedTokenIds(questIds) {
  const found = {};
  const missing = [];
  for (const qid of questIds) {
    const cached = loadTokenId(qid);
    if (cached) found[qid] = cached;
    else missing.push(qid);
  }
  if (missing.length === 0) return found;

  const total = Number(await withReadProvider((p) => readContract(p).nextTokenId())) - 1;
  if (total <= 0 || total > TOKEN_SCAN_CAP) return found; // scan not feasible

  // Scan ownerOf() in chunks; stop as soon as every missing quest is found.
  const CHUNK = 25;
  for (let start = 1; start <= total && missing.length > 0; start += CHUNK) {
    const ids = [];
    for (let i = start; i < Math.min(start + CHUNK, total + 1); i++) ids.push(i);
    const owners = await withReadProvider((p) => {
      const c = readContract(p);
      return Promise.all(ids.map((id) => c.ownerOf(id).catch(() => null)));
    });
    for (let j = 0; j < ids.length; j++) {
      if (owners[j] && owners[j].toLowerCase() === account.toLowerCase()) {
        const questId = Number(
          await withReadProvider((p) => readContract(p).tokenQuest(ids[j]))
        );
        if (missing.includes(questId)) {
          found[questId] = String(ids[j]);
          saveTokenId(questId, ids[j]);
          missing.splice(missing.indexOf(questId), 1);
        }
      }
    }
  }
  return found;
}

function parseTokenUri(uri) {
  const prefix = "data:application/json;base64,";
  if (typeof uri !== "string" || !uri.startsWith(prefix)) return null;
  try {
    return JSON.parse(atob(uri.slice(prefix.length)));
  } catch {
    return null;
  }
}

/** Local preview using the exact SVG layout the contract itself renders. */
function localBadgeSvg(quest, label) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">` +
    `<rect width="400" height="400" rx="24" fill="${quest.color}"/>` +
    `<text x="200" y="140" font-family="sans-serif" font-size="30" font-weight="bold" fill="#ffffff" text-anchor="middle">AgentQuest</text>` +
    `<text x="200" y="205" font-family="sans-serif" font-size="26" fill="#ffffff" text-anchor="middle">${quest.name}</text>` +
    `<text x="200" y="255" font-family="sans-serif" font-size="16" fill="#ffffff" text-anchor="middle">${label}</text>` +
    `<text x="200" y="295" font-family="sans-serif" font-size="14" fill="#ffffff" text-anchor="middle">Soulbound - Binance Agent ID</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function renderBadgesEmpty(message) {
  const list = $("badge-list");
  list.replaceChildren();
  const p = document.createElement("p");
  p.className = "empty-note";
  p.textContent = message;
  list.appendChild(p);
}

async function renderBadges() {
  const list = $("badge-list");
  if (!account || !isDeployed) {
    renderBadgesEmpty(
      !account
        ? "Connect your wallet to see your badges."
        : "The contract is not deployed yet — no badges exist."
    );
    return;
  }

  const ownedQuestIds = QUESTS.filter((q) => status.quests[q.id].claimed).map((q) => q.id);
  if (ownedQuestIds.length === 0) {
    renderBadgesEmpty("No badges yet. Claim a quest above to earn your first badge.");
    return;
  }

  list.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "empty-note";
  loading.textContent = "Loading your badges…";
  list.appendChild(loading);

  let tokenIds = {};
  try {
    tokenIds = await findOwnedTokenIds(ownedQuestIds);
  } catch {
    // Fall through: badges still render from claimed() status.
  }

  list.replaceChildren();
  for (const questId of ownedQuestIds) {
    const quest = QUESTS[questId];
    const tokenId = tokenIds[questId] ?? null;
    let imageSrc = localBadgeSvg(quest, "Claimed badge");
    let badgeLabel = "Claimed";

    if (tokenId !== null) {
      try {
        const uri = await withReadProvider((p) => readContract(p).tokenURI(tokenId));
        const meta = parseTokenUri(uri);
        if (meta && typeof meta.image === "string") imageSrc = meta.image;
        badgeLabel = `Badge #${tokenId}`;
      } catch {
        badgeLabel = `Badge #${tokenId}`;
      }
    }

    const card = document.createElement("article");
    card.className = "badge-card";
    const img = document.createElement("img");
    img.src = imageSrc;
    img.alt = `AgentQuest badge: ${quest.name}`;
    card.appendChild(img);

    const body = document.createElement("div");
    body.className = "badge-body";
    const title = document.createElement("h3");
    title.textContent = quest.name;
    body.appendChild(title);
    const sub = document.createElement("p");
    sub.textContent = `${badgeLabel} · Soulbound`;
    body.appendChild(sub);
    if (tokenId !== null) {
      const link = document.createElement("p");
      const a = document.createElement("a");
      a.href = bscscanToken(tokenId);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "View on BscScan";
      link.appendChild(a);
      body.appendChild(link);
    }
    card.appendChild(body);
    list.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// Errors, in plain language
// ---------------------------------------------------------------------------

function friendlyError(err) {
  const msg = err && err.message ? String(err.message) : "";
  const code = err && err.code;

  if (msg === "WRONG_NETWORK") {
    return "Your wallet is not on BNB Smart Chain (chain 56). Switch networks and try again.";
  }
  if (msg === "NOT_ELIGIBLE_NOW") {
    return "This wallet is no longer eligible for that quest. The page has the latest status — please refresh.";
  }
  if (msg === "ALREADY_CHECKED_IN") {
    return "You already checked in today. Come back tomorrow (UTC).";
  }
  if (code === 4001 || /user rejected|user denied/i.test(msg)) {
    return "Transaction rejected in your wallet. Nothing was sent.";
  }
  if (/insufficient funds/i.test(msg)) {
    return "Not enough BNB in your wallet to pay for gas.";
  }
  if (/AlreadyClaimed/.test(msg)) {
    return "You already claimed this badge.";
  }
  if (/AlreadyCheckedInToday/.test(msg)) {
    return "You already checked in today. Come back tomorrow (UTC).";
  }
  if (/NotAgentQuestHolder/.test(msg)) {
    return "This wallet holds no AgentQuest badge yet — claim one first to check in.";
  }
  if (/NotAgentIdHolder/.test(msg)) {
    return "This wallet does not hold an Agent ID, which is required for badges and check-ins.";
  }
  if (/NotEligible/.test(msg)) {
    return "This wallet does not meet this quest's requirement yet.";
  }
  if (/InvalidQuest/.test(msg)) {
    return "Unknown quest.";
  }
  if (/network|fetch|timeout|failed/i.test(msg) && code !== "CALL_EXCEPTION") {
    return "Could not reach BNB Chain. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Static content + init
// ---------------------------------------------------------------------------

function renderCuratedList() {
  const list = $("curated-list");
  $("curated-count").textContent = String(CURATED.length);
  for (const c of CURATED) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "curated-name";
    const a = document.createElement("a");
    a.href = `${BSCSCAN_BASE}/address/${c.address}`;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = c.name;
    name.appendChild(a);
    const minted = document.createElement("span");
    minted.className = "curated-minted";
    minted.textContent = `${c.minted.toLocaleString("en-US")} minted`;
    li.appendChild(name);
    li.appendChild(minted);
    list.appendChild(li);
  }
}

function renderContractInfo() {
  const addrEl = $("contract-address");
  const linkEl = $("contract-link");
  if (isDeployed) {
    addrEl.textContent = CONTRACT_ADDRESS;
    linkEl.href = `${BSCSCAN_BASE}/address/${CONTRACT_ADDRESS}`;
    linkEl.hidden = false;
  } else {
    addrEl.textContent = "not deployed yet";
    linkEl.hidden = true;
    $("deploy-banner").hidden = false;
  }
}

function wireWalletEvents() {
  if (!window.ethereum || typeof window.ethereum.on !== "function") return;
  window.ethereum.on("accountsChanged", (accounts) => {
    if (!accounts || accounts.length === 0) {
      disconnectWallet();
      return;
    }
    account = ethers.getAddress(accounts[0]);
    updateWalletUI();
    refreshAll();
  });
  window.ethereum.on("chainChanged", async () => {
    // Recreate the provider: ethers caches the network on the old one.
    walletProvider = new ethers.BrowserProvider(window.ethereum);
    signer = await walletProvider.getSigner();
    const network = await walletProvider.getNetwork();
    walletChainId = Number(network.chainId);
    updateNetworkUI();
    await refreshAll();
  });
}

async function init() {
  renderCuratedList();
  renderContractInfo();
  renderAgentId();
  renderHeld();
  renderKongBenefits();
  renderStreak();
  renderQuests();
  renderBadgesEmpty("Connect your wallet to see your badges.");
  loadLeaderboard(); // no wallet needed; renders when the snapshot arrives

  $("connect-btn").addEventListener("click", () => {
    if (account) disconnectWallet();
    else connectWallet();
  });
  $("switch-network-btn").addEventListener("click", async () => {
    try {
      await switchToBsc();
    } catch (err) {
      showError(friendlyError(err));
    }
  });
  $("claim-all-btn").addEventListener("click", claimAllQuests);
  $("checkin-btn").addEventListener("click", checkIn);

  wireWalletEvents();

  // Silent reconnect if the wallet is already authorized (no prompt).
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts && accounts.length > 0) {
        walletProvider = new ethers.BrowserProvider(window.ethereum);
        account = ethers.getAddress(accounts[0]);
        signer = await walletProvider.getSigner();
        const network = await walletProvider.getNetwork();
        walletChainId = Number(network.chainId);
        updateWalletUI();
        await refreshAll();
      }
    } catch {
      // Stay disconnected; the user can connect manually.
    }
  }
}

init();
