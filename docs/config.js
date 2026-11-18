// AgentQuest frontend configuration.
//
// The ONLY value that must change after the contract is deployed is
// CONTRACT_ADDRESS below. Everything else is already final.

// TODO(after deploy): replace with the deployed AgentQuest contract address.
// Until then the app runs in "not deployed yet" mode: the Agent ID status
// check still works, but quest eligibility and claims stay disabled.
export const CONTRACT_ADDRESS = "0x26ad277193ff31bd086a47bf7b1d25a93573c989";

// Canonical SPACE ID Agent ID registry on BNB Chain (verified in the
// Binance Agent ID Hackathon announcement). Never changes.
export const AGENT_ID_ADDRESS = "0x60b9262456de011f7d15a54cdd8c48baaa8b022f";

// BNB Smart Chain mainnet.
export const CHAIN_ID = 56;
export const CHAIN_ID_HEX = "0x38";
export const CHAIN_NAME = "BNB Smart Chain";

// Parameters used when prompting the wallet to add BSC (error 4902).
export const BSC_CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: CHAIN_NAME,
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: ["https://bsc-dataseed.bnbchain.org"],
  blockExplorerUrls: ["https://bscscan.com"],
};

// Public read-only BSC RPC endpoints, tried in order until one answers.
// All eligibility reads go through these (never through the user's wallet
// provider), so reads work even before the wallet is on the right network.
export const RPC_URLS = [
  "https://bsc-dataseed.bnbchain.org",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
  "https://bsc-dataseed3.bnbchain.org",
  "https://bsc-dataseed4.bnbchain.org",
  "https://bsc.publicnode.com",
  "https://bsc.meowrpc.com",
];

export const BSCSCAN_BASE = "https://bscscan.com";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Minimal AgentQuest ABI — only the functions this frontend uses.
// Signatures verified against out/AgentQuest.sol/AgentQuest.json.
// Custom errors are included so ethers v6 can decode revert reasons.
export const AGENTQUEST_ABI = [
  // Claims (nonpayable — no value can ever be attached)
  "function claim(uint8 questId)",
  "function claimAll()",
  // Eligibility views (free off-chain reads)
  "function isEligible(uint8 questId, address holder) view returns (bool)",
  "function heldCount(address holder) view returns (uint256)",
  "function claimed(uint8 questId, address holder) view returns (bool)",
  // Badge metadata / ownership
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function tokenQuest(uint256 tokenId) view returns (uint8)",
  "function nextTokenId() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function locked(uint256 tokenId) view returns (bool)",
  // Contract info
  "function curatedLength() view returns (uint256)",
  "function agentId() view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  // Events (used to learn the tokenId of a freshly claimed badge)
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  // Custom errors (for human-readable revert messages)
  "error AlreadyClaimed(uint8 questId, address holder)",
  "error NotAgentIdHolder(address holder)",
  "error NotEligible(uint8 questId, address holder)",
  "error InvalidQuest(uint8 questId)",
  "error Soulbound()",
];

// The Agent ID registry only ever needs balanceOf. Note: it does NOT
// implement totalSupply() (the call reverts) — never call it.
export const AGENT_ID_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
];

// Quest metadata. Thresholds and colours match AgentQuest.sol exactly
// (QUEST_HOLDER 0 / COLLECTOR_I 1 / COLLECTOR_II 2 / COLLECTOR_III 3;
// colours #6366f1 / #22c55e / #f59e0b / #a855f7).
export const QUESTS = [
  {
    id: 0,
    name: "Agent ID Holder",
    tagline: "You are part of the Agent ID ecosystem.",
    requirement: "Hold a Binance Agent ID (.ai)",
    threshold: null, // no collection count needed — the Agent ID itself is the proof
    color: "#6366f1",
  },
  {
    id: 1,
    name: "Collector I",
    tagline: "First steps as a collector.",
    requirement: "Hold NFTs from at least 3 curated collections",
    threshold: 3,
    color: "#22c55e",
  },
  {
    id: 2,
    name: "Collector II",
    tagline: "A growing cross-project collection.",
    requirement: "Hold NFTs from at least 10 curated collections",
    threshold: 10,
    color: "#f59e0b",
  },
  {
    id: 3,
    name: "Collector III",
    tagline: "One of the ecosystem's most dedicated collectors.",
    requirement: "Hold NFTs from at least 25 curated collections",
    threshold: 25,
    color: "#a855f7",
  },
];

// The 30 curated collections counted toward the Collector quests.
// Order and addresses match script/DeployAgentQuest.s.sol exactly — the list
// is immutable in the deployed contract, so this copy must never drift.
// Minted counts are the radar snapshot values at derivation time (18 Nov 2026).
export const CURATED = [
  { name: "sidecoo Daily", address: "0x409Cfe3747f1ac20f267B50BCbB6a4E9406DA3a8", minted: 29373 },
  { name: "Pilot Boarding Pass", address: "0xc267E47F1Ba3B6B2BCbA58f16298c92CaCAF7952", minted: 25026 },
  { name: "Nemotron Sigil", address: "0xDd8BdfC91cbD572935B09863A742d8296fed0ACf", minted: 17553 },
  { name: "LeadLoop", address: "0xe887584746A1375d732854b3B67460a2A73ae0a9", minted: 10000 },
  { name: "HIRELINGS", address: "0x6b1D77D3DeDE3FC775ca8C7BDe08C2C2EAAb9BEA", minted: 10000 },
  { name: "HashOre", address: "0x828e7073Ef57Ed778E4acF82cC45BC43eF760b54", minted: 10000 },
  { name: "Binance Agent Oracle", address: "0xcBe2DBBFF4264Dc67Bf557c64e29997B82439354", minted: 9202 },
  { name: "Agentlings", address: "0xBf3488E453c68e9771C26D448E99d0EC5395135f", minted: 8851 },
  { name: "CactiCore", address: "0x6af0307E75B8153340E2723c1468a2412a160080", minted: 7298 },
  { name: "Glyphora", address: "0x4c1A7eA2070f0ADF833e28d7FE8e1b8F62CF27F8", minted: 7296 },
  { name: "MothWire", address: "0xd584D5CD6A28Af35f52aE90c4B436132858fc36D", minted: 7164 },
  { name: "Tacotron", address: "0x05deBE4445232205AE7E79d02cb5DE5AA0641efF", minted: 7008 },
  { name: "The Claf Eye", address: "0x1c759C4e075103b5B250DB5114B832b17B99C456", minted: 6988 },
  { name: "Agent Miner", address: "0xCe67038f8703Dff3Aadaf77d41823b4b039C9446", minted: 6403 },
  { name: "SYMBOL", address: "0x993C822E7d9bBC75aa6b5095bD90a011Ff38cF71", minted: 6220 },
  { name: "Agent Cosmos", address: "0x3Aeda314ec05BC22E3c26a543E16Df2B8cC8fe69", minted: 5349 },
  { name: "Voltoad", address: "0xbC95E0a5Bb1305958Ba3263C6E9943b7A2554757", minted: 5195 },
  { name: "Agent Apes", address: "0xbF18B0CfDd9e4FD138a362A92F29674197Fdb886", minted: 5126 },
  { name: "PassAgentX", address: "0x08b1A979Dd997492EEcc010fe986eA2e2925e620", minted: 5100 },
  { name: "Kitesy", address: "0x8cc691D0EEf7870460e2886Aa1075bF3468710a2", minted: 4206 },
  { name: "Ghostling", address: "0x6A4847Cb5f658943222FBd23D2520049F824789d", minted: 4171 },
  { name: "AGENTONE Hero", address: "0x9B0c237A123277fCf8768550Bbdd7767C73Cf5D3", minted: 4168 },
  { name: "Pixel Sentinels", address: "0x4e4e43f84E2E80716d03153F3c675e8E715Fa698", minted: 4132 },
  { name: "Arcadion", address: "0x8d0f3FCdaec965120C53a753a456Ed85A6624aD3", minted: 3563 },
  { name: "Peachling", address: "0xa340ba0FeAcBBD17cBb1622C4d33Ed32720E1F83", minted: 3545 },
  { name: "Foxglow", address: "0x6E159c9CD56BeadB523B80d195DdE39C042a1D48", minted: 3329 },
  { name: "Polar Bear", address: "0x4673c787Fb192285a7eCD69860503CA3e95bD765", minted: 3320 },
  { name: "Dropnix", address: "0xB95531Eb859c556B7c9521a99B7b67BA12519564", minted: 3227 },
  { name: "Bobaloo", address: "0x072109f54dCca581e45C6FF3516e6Af9BDcbdc60", minted: 3216 },
  { name: "Jalopix", address: "0x04f3E2A5c4883c67F732Dff38DCA137F41122C62", minted: 3134 },
];

// The contract has no token enumeration (no tokenOfOwnerByIndex), so the
// frontend finds a wallet's badge tokenIds by scanning ownerOf(1..N).
// This cap bounds that scan; beyond it, owned badges are still shown from
// per-quest claimed status, but without their on-chain tokenId/SVG.
export const TOKEN_SCAN_CAP = 1000;
