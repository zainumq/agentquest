// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Minimal interface for the read we need from the Agent ID registry
/// and from every curated NFT contract. The Agent ID registry does NOT
/// implement totalSupply() (it reverts), so only balanceOf is ever called.
interface IERC721Balance {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title AgentQuest — on-chain achievement badges for Binance Agent ID holders
/// @notice Soulbound (ERC-5192) ERC-721 badges. Any wallet holding a Binance
/// Agent ID (.ai) can claim badges by proving, purely on-chain, that it holds
/// NFTs from a curated list of Agent ID ecosystem collections. No server, no
/// voucher, no oracle, no owner, no admin, no fees — claims are gas-only.
/// @dev Built for the Binance Agent ID Hackathon (Nov–Dec 2026).
/// Quest config is immutable: set once in the constructor, no setter exists.
contract AgentQuest is ERC721 {
    using Strings for uint256;

    /// @dev ERC-5192 interface id: bytes4(keccak256("locked(uint256)")).
    bytes4 private constant _INTERFACE_ID_ERC5192 = 0xb45a3c0e;

    /// @notice Canonical SPACE ID Agent ID registry on BNB Chain
    /// (0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F). Immutable: the gate can
    /// never be re-pointed at a different contract.
    address public immutable agentId;

    /// @notice Curated NFT contracts counted toward the Collector quests.
    /// Set once in the constructor; no function can change this list.
    address[] public curated;

    uint8 public constant QUEST_HOLDER = 0;
    uint8 public constant QUEST_COLLECTOR_I = 1;
    uint8 public constant QUEST_COLLECTOR_II = 2;
    uint8 public constant QUEST_COLLECTOR_III = 3;
    uint8 public constant QUEST_COUNT = 4;

    uint256 public constant COLLECTOR_I_THRESHOLD = 3;
    uint256 public constant COLLECTOR_II_THRESHOLD = 10;
    uint256 public constant COLLECTOR_III_THRESHOLD = 25;

    /// @notice questId => holder => claimed. One badge per quest per wallet.
    mapping(uint8 => mapping(address => bool)) public claimed;

    /// @notice tokenId => questId of the badge it represents.
    mapping(uint256 => uint8) public tokenQuest;

    /// @notice Next token id to mint. Token ids start at 1.
    uint256 public nextTokenId = 1;

    /// @dev ERC-5192 events. Every badge is locked at mint; Unlocked is never
    /// emitted because badges are permanently locked.
    event Locked(uint256 indexed tokenId);
    event Unlocked(uint256 indexed tokenId);

    error InvalidQuest(uint8 questId);
    error AlreadyClaimed(uint8 questId, address holder);
    error NotAgentIdHolder(address holder);
    error NotEligible(uint8 questId, address holder);
    error Soulbound();
    error InvalidCuratedList();

    constructor(address agentId_, address[] memory curated_) ERC721("AgentQuest Badge", "AQBADGE") {
        if (agentId_ == address(0) || curated_.length == 0) revert InvalidCuratedList();
        agentId = agentId_;
        uint256 len = curated_.length;
        for (uint256 i = 0; i < len; ++i) {
            address c = curated_[i];
            if (c == address(0)) revert InvalidCuratedList();
            for (uint256 j = 0; j < i; ++j) {
                if (curated_[j] == c) revert InvalidCuratedList();
            }
            curated.push(c);
        }
    }

    // ------------------------------------------------------------------------
    // Claims (gas-only: NOT payable, so no value can ever be attached)
    // ------------------------------------------------------------------------

    /// @notice Claim one quest badge. Reverts if the caller holds no Agent ID,
    /// is not eligible for the quest, or already claimed this badge.
    /// @dev Call `isEligible(questId, msg.sender)` off-chain first: a reverted
    /// claim still costs gas (the eligibility scan reads up to 30 contracts).
    function claim(uint8 questId) external {
        if (questId >= QUEST_COUNT) revert InvalidQuest(questId);
        if (claimed[questId][msg.sender]) revert AlreadyClaimed(questId, msg.sender);
        if (!_hasAgentId(msg.sender)) revert NotAgentIdHolder(msg.sender);
        if (!_isEligible(questId, msg.sender)) revert NotEligible(questId, msg.sender);
        _mintBadge(questId, msg.sender);
    }

    /// @notice Claim every badge the caller is currently eligible for and has
    /// not claimed yet, in a single transaction. Skips (does not revert on)
    /// quests the caller is ineligible for or already claimed.
    function claimAll() external {
        if (!_hasAgentId(msg.sender)) revert NotAgentIdHolder(msg.sender);
        for (uint8 q = 0; q < QUEST_COUNT; ++q) {
            if (!claimed[q][msg.sender] && _isEligible(q, msg.sender)) {
                _mintBadge(q, msg.sender);
            }
        }
    }

    function _mintBadge(uint8 questId, address holder) internal {
        claimed[questId][holder] = true;
        uint256 tokenId = nextTokenId++;
        tokenQuest[tokenId] = questId;
        _safeMint(holder, tokenId);
        emit Locked(tokenId);
    }

    // ------------------------------------------------------------------------
    // Eligibility views (free off-chain reads — frontends must check first)
    // ------------------------------------------------------------------------

    /// @notice Number of distinct curated collections `holder` owns at least
    /// one NFT of.
    function heldCount(address holder) external view returns (uint256) {
        return _heldCount(holder, curated.length);
    }

    /// @notice True if `holder` can currently claim `questId` (holds an Agent
    /// ID, meets the quest threshold, and has not claimed it yet).
    function isEligible(uint8 questId, address holder) external view returns (bool) {
        if (questId >= QUEST_COUNT) return false;
        if (claimed[questId][holder]) return false;
        if (!_hasAgentId(holder)) return false;
        return _isEligible(questId, holder);
    }

    /// @notice Number of curated contracts (length of the immutable list).
    function curatedLength() external view returns (uint256) {
        return curated.length;
    }

    function _hasAgentId(address holder) internal view returns (bool) {
        return IERC721Balance(agentId).balanceOf(holder) > 0;
    }

    function _isEligible(uint8 questId, address holder) internal view returns (bool) {
        if (questId == QUEST_HOLDER) return true; // Agent ID gate already passed
        uint256 threshold = questId == QUEST_COLLECTOR_I
            ? COLLECTOR_I_THRESHOLD
            : questId == QUEST_COLLECTOR_II
                ? COLLECTOR_II_THRESHOLD
                : COLLECTOR_III_THRESHOLD;
        return _heldCount(holder, threshold) >= threshold;
    }

    /// @notice Count distinct curated collections held, stopping early once
    /// `stopAt` is reached (gas saver: Collector I stops after 3 hits instead
    /// of scanning all 30 contracts).
    function _heldCount(address holder, uint256 stopAt) internal view returns (uint256 count) {
        uint256 len = curated.length;
        for (uint256 i = 0; i < len; ++i) {
            if (_balanceOf(curated[i], holder) > 0) {
                ++count;
                if (count >= stopAt) break;
            }
        }
    }

    /// @notice balanceOf with failure tolerance: if a curated contract ever
    /// stops answering (revert / no code), it counts as 0 instead of breaking
    /// every claim. The Agent ID gate itself is NOT wrapped — a reverting
    /// registry means something is deeply wrong and claims should fail loud.
    function _balanceOf(address token, address holder) internal view returns (uint256) {
        try IERC721Balance(token).balanceOf(holder) returns (uint256 bal) {
            return bal;
        } catch {
            return 0;
        }
    }

    // ------------------------------------------------------------------------
    // Soulbound (ERC-5192)
    // ------------------------------------------------------------------------

    /// @notice ERC-5192: true for every existing badge (permanently locked).
    /// Reverts for nonexistent tokens, as the EIP requires.
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    /// @notice Only minting is allowed. Transfers (and burns) revert: badges
    /// are permanently bound to the wallet that earned them.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        if (_ownerOf(tokenId) != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    /// @notice Approvals are meaningless for soulbound tokens and always revert.
    function approve(address /*to*/, uint256 /*tokenId*/) public pure override {
        revert Soulbound();
    }

    /// @notice Approvals are meaningless for soulbound tokens and always revert.
    function setApprovalForAll(address /*operator*/, bool /*approved*/) public pure override {
        revert Soulbound();
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == _INTERFACE_ID_ERC5192 || super.supportsInterface(interfaceId);
    }

    // ------------------------------------------------------------------------
    // Fully on-chain metadata (SVG + JSON, no IPFS / server dependency)
    // ------------------------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint8 questId = tokenQuest[tokenId];
        string memory name = _questName(questId);
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
            '<rect width="400" height="400" rx="24" fill="',
            _questColor(questId),
            '"/>',
            '<text x="200" y="140" font-family="sans-serif" font-size="30" font-weight="bold" fill="#ffffff" text-anchor="middle">AgentQuest</text>',
            '<text x="200" y="205" font-family="sans-serif" font-size="26" fill="#ffffff" text-anchor="middle">',
            name,
            "</text>",
            '<text x="200" y="255" font-family="sans-serif" font-size="16" fill="#ffffff" text-anchor="middle">Badge #',
            tokenId.toString(),
            "</text>",
            '<text x="200" y="295" font-family="sans-serif" font-size="14" fill="#ffffff" text-anchor="middle">Soulbound - Binance Agent ID</text>',
            "</svg>"
        );
        string memory json = string.concat(
            '{"name":"AgentQuest Badge - ',
            name,
            '","description":"On-chain achievement badge for Binance Agent ID holders. Soulbound (ERC-5192), earned by holding Agent ID NFTs across the ecosystem. No server, no voucher - verified purely on-chain.",',
            '"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Quest","value":"',
            name,
            '"},{"trait_type":"Tier","value":',
            uint256(questId).toString(),
            '},{"trait_type":"Soulbound","value":"Yes"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _questName(uint8 questId) internal pure returns (string memory) {
        if (questId == QUEST_HOLDER) return "Agent ID Holder";
        if (questId == QUEST_COLLECTOR_I) return "Collector I";
        if (questId == QUEST_COLLECTOR_II) return "Collector II";
        return "Collector III";
    }

    function _questColor(uint8 questId) internal pure returns (string memory) {
        if (questId == QUEST_HOLDER) return "#6366f1";
        if (questId == QUEST_COLLECTOR_I) return "#22c55e";
        if (questId == QUEST_COLLECTOR_II) return "#f59e0b";
        return "#a855f7";
    }
}
