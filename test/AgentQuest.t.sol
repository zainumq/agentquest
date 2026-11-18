// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AgentQuest} from "../src/AgentQuest.sol";

/// @notice Minimal mock for any balanceOf-only contract: the Agent ID registry
/// and each curated NFT collection. Balances are set directly by the test.
contract MockBalance {
    mapping(address => uint256) public balances;

    function setBalance(address owner, uint256 bal) external {
        balances[owner] = bal;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return balances[owner];
    }
}

/// @notice Mock whose balanceOf always reverts — used to prove the contract
/// tolerates a broken curated contract instead of bricking all claims.
contract MockRevertingBalance {
    function balanceOf(address) external pure returns (uint256) {
        revert("mock boom");
    }
}

contract AgentQuestTest is Test {
    AgentQuest public quest;
    MockBalance public agentId;
    MockBalance[] public nfts;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant CURATED_N = 30;

    function setUp() public {
        agentId = new MockBalance();
        address[] memory curated = new address[](CURATED_N);
        for (uint256 i = 0; i < CURATED_N; ++i) {
            MockBalance m = new MockBalance();
            nfts.push(m);
            curated[i] = address(m);
        }
        quest = new AgentQuest(address(agentId), curated);
    }

    // -- helpers -------------------------------------------------------------

    function _giveAgentId(address user) internal {
        agentId.setBalance(user, 1);
    }

    /// @dev Give `user` balance 1 on the first `n` curated mocks.
    function _giveNfts(address user, uint256 n) internal {
        for (uint256 i = 0; i < n; ++i) {
            nfts[i].setBalance(user, 1);
        }
    }

    // -- constructor validation ----------------------------------------------

    function testConstructorRevertsOnZeroAgentId() public {
        address[] memory curated = new address[](1);
        curated[0] = address(nfts[0]);
        vm.expectRevert(AgentQuest.InvalidCuratedList.selector);
        new AgentQuest(address(0), curated);
    }

    function testConstructorRevertsOnEmptyCurated() public {
        vm.expectRevert(AgentQuest.InvalidCuratedList.selector);
        new AgentQuest(address(agentId), new address[](0));
    }

    function testConstructorRevertsOnDuplicateCurated() public {
        address[] memory curated = new address[](2);
        curated[0] = address(nfts[0]);
        curated[1] = address(nfts[0]);
        vm.expectRevert(AgentQuest.InvalidCuratedList.selector);
        new AgentQuest(address(agentId), curated);
    }

    function testConstructorStoresConfig() public view {
        assertEq(quest.agentId(), address(agentId));
        assertEq(quest.curatedLength(), CURATED_N);
        assertEq(quest.curated(0), address(nfts[0]));
        assertEq(quest.name(), "AgentQuest Badge");
        assertEq(quest.symbol(), "AQBADGE");
    }

    // -- Agent ID gating ------------------------------------------------------

    function testClaimRevertsWithoutAgentId() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentQuest.NotAgentIdHolder.selector, alice));
        quest.claim(0);
    }

    function testClaimAllRevertsWithoutAgentId() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentQuest.NotAgentIdHolder.selector, alice));
        quest.claimAll();
    }

    function testIsEligibleFalseWithoutAgentId() public view {
        assertFalse(quest.isEligible(0, alice));
    }

    // -- Quest 0: Agent ID Holder ----------------------------------------------

    function testClaimHolderSuccess() public {
        _giveAgentId(alice);
        vm.prank(alice);
        quest.claim(0);
        assertEq(quest.balanceOf(alice), 1);
        assertEq(quest.ownerOf(1), alice);
        assertEq(quest.tokenQuest(1), 0);
        assertTrue(quest.claimed(0, alice));
        assertEq(quest.nextTokenId(), 2);
    }

    function testDoubleClaimReverts() public {
        _giveAgentId(alice);
        vm.startPrank(alice);
        quest.claim(0);
        vm.expectRevert(abi.encodeWithSelector(AgentQuest.AlreadyClaimed.selector, 0, alice));
        quest.claim(0);
        vm.stopPrank();
    }

    function testInvalidQuestReverts() public {
        _giveAgentId(alice);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentQuest.InvalidQuest.selector, 4));
        quest.claim(4);
    }

    function testClaimWithValueReverts() public {
        _giveAgentId(alice);
        vm.prank(alice);
        vm.deal(alice, 1 ether);
        // claim() is not payable: any attached value reverts.
        (bool ok,) = address(quest).call{value: 0.001 ether}(
            abi.encodeWithSelector(AgentQuest.claim.selector, uint8(0))
        );
        assertFalse(ok);
        assertEq(quest.balanceOf(alice), 0);
    }

    // -- Collector tiers: eligible + ineligible --------------------------------

    function testCollectorIEligibleAt3() public {
        _giveAgentId(alice);
        _giveNfts(alice, 3);
        assertEq(quest.heldCount(alice), 3);
        assertTrue(quest.isEligible(1, alice));
        vm.prank(alice);
        quest.claim(1);
        assertEq(quest.tokenQuest(1), 1);
    }

    function testCollectorIIneligibleAt2() public {
        _giveAgentId(alice);
        _giveNfts(alice, 2);
        assertFalse(quest.isEligible(1, alice));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentQuest.NotEligible.selector, 1, alice));
        quest.claim(1);
    }

    function testCollectorIIEligibleAt10() public {
        _giveAgentId(alice);
        _giveNfts(alice, 10);
        assertTrue(quest.isEligible(2, alice));
        vm.prank(alice);
        quest.claim(2);
        assertEq(quest.tokenQuest(1), 2);
    }

    function testCollectorIIIneligibleAt9() public {
        _giveAgentId(alice);
        _giveNfts(alice, 9);
        assertFalse(quest.isEligible(2, alice));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentQuest.NotEligible.selector, 2, alice));
        quest.claim(2);
    }

    function testCollectorIIIEligibleAt25() public {
        _giveAgentId(alice);
        _giveNfts(alice, 25);
        assertTrue(quest.isEligible(3, alice));
        vm.prank(alice);
        quest.claim(3);
        assertEq(quest.tokenQuest(1), 3);
    }

    function testCollectorIIIIneligibleAt24() public {
        _giveAgentId(alice);
        _giveNfts(alice, 24);
        assertFalse(quest.isEligible(3, alice));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentQuest.NotEligible.selector, 3, alice));
        quest.claim(3);
    }

    function testHeldCountCountsDistinctCollectionsOnly() public {
        _giveAgentId(alice);
        // 5 tokens in ONE collection still counts as 1 collection held.
        nfts[0].setBalance(alice, 5);
        nfts[1].setBalance(alice, 2);
        assertEq(quest.heldCount(alice), 2);
        assertFalse(quest.isEligible(1, alice));
    }

    function testFuzzHeldCount(uint8 n) public {
        n = uint8(bound(n, 0, CURATED_N));
        _giveNfts(alice, n);
        assertEq(quest.heldCount(alice), n);
    }

    // -- claimAll ----------------------------------------------------------------

    function testClaimAllMintsAllEligible() public {
        _giveAgentId(alice);
        _giveNfts(alice, 10); // eligible for quests 0, 1, 2 — not 3
        vm.prank(alice);
        quest.claimAll();
        assertEq(quest.balanceOf(alice), 3);
        assertTrue(quest.claimed(0, alice));
        assertTrue(quest.claimed(1, alice));
        assertTrue(quest.claimed(2, alice));
        assertFalse(quest.claimed(3, alice));
    }

    function testClaimAllSkipsAlreadyClaimed() public {
        _giveAgentId(alice);
        _giveNfts(alice, 25);
        vm.startPrank(alice);
        quest.claim(0);
        quest.claimAll(); // must not revert on quest 0; claims 1, 2, 3
        vm.stopPrank();
        assertEq(quest.balanceOf(alice), 4);
    }

    // -- Soulbound (ERC-5192) -----------------------------------------------------

    function testTransferReverts() public {
        _giveAgentId(alice);
        vm.prank(alice);
        quest.claim(0);
        vm.prank(alice);
        vm.expectRevert(AgentQuest.Soulbound.selector);
        quest.transferFrom(alice, bob, 1);
    }

    function testSafeTransferReverts() public {
        _giveAgentId(alice);
        vm.prank(alice);
        quest.claim(0);
        vm.prank(alice);
        vm.expectRevert(AgentQuest.Soulbound.selector);
        quest.safeTransferFrom(alice, bob, 1);
    }

    function testApproveReverts() public {
        _giveAgentId(alice);
        vm.prank(alice);
        quest.claim(0);
        vm.prank(alice);
        vm.expectRevert(AgentQuest.Soulbound.selector);
        quest.approve(bob, 1);
    }

    function testSetApprovalForAllReverts() public {
        _giveAgentId(alice);
        vm.prank(alice);
        vm.expectRevert(AgentQuest.Soulbound.selector);
        quest.setApprovalForAll(bob, true);
    }

    function testLockedViewTrue() public {
        _giveAgentId(alice);
        vm.prank(alice);
        quest.claim(0);
        assertTrue(quest.locked(1));
    }

    function testLockedViewRevertsForNonexistent() public {
        vm.expectRevert();
        quest.locked(999);
    }

    function testSupportsERC5192Interface() public view {
        assertTrue(quest.supportsInterface(0xb45a3c0e)); // ERC-5192
        assertTrue(quest.supportsInterface(0x80ac58cd)); // ERC-721
    }

    // -- Resilience: a reverting curated contract must not brick claims -----------

    function testBrokenCuratedContractCountsAsZero() public {
        // Rebuild with a reverting contract at index 0 + 29 working mocks.
        address[] memory curated = new address[](CURATED_N);
        curated[0] = address(new MockRevertingBalance());
        for (uint256 i = 1; i < CURATED_N; ++i) {
            curated[i] = address(nfts[i]);
        }
        AgentQuest q2 = new AgentQuest(address(agentId), curated);
        _giveAgentId(alice);
        _giveNfts(alice, 3); // mocks 0,1,2 — mock 0 is NOT in q2's list
        // Only mocks 1 and 2 count for q2 (mock 0 replaced by reverting one).
        assertEq(q2.heldCount(alice), 2);
        assertFalse(q2.isEligible(1, alice));
        nfts[3].setBalance(alice, 1);
        assertEq(q2.heldCount(alice), 3);
        assertTrue(q2.isEligible(1, alice));
        vm.prank(alice);
        q2.claim(1);
        assertEq(q2.balanceOf(alice), 1);
    }

    // -- tokenURI: fully on-chain metadata ------------------------------------------

    function testTokenURIIsDataUriWithQuestName() public {
        _giveAgentId(alice);
        _giveNfts(alice, 3);
        vm.prank(alice);
        quest.claim(1);
        string memory uri = quest.tokenURI(1);
        string memory prefix = "data:application/json;base64,";
        assertTrue(_startsWith(uri, prefix));
        string memory b64 = _substring(uri, bytes(prefix).length, bytes(uri).length);
        string memory json = string(_b64decode(b64));
        assertTrue(_contains(json, "Collector I"));
        assertTrue(_contains(json, "data:image/svg+xml;base64"));
        assertTrue(_contains(json, "AgentQuest Badge"));
    }

    function testTokenURIRevertsForNonexistent() public {
        vm.expectRevert();
        quest.tokenURI(999);
    }

    // -- string/base64 helpers for the tokenURI test ---------------------------------

    function _startsWith(string memory s, string memory prefix) internal pure returns (bool) {
        bytes memory a = bytes(s);
        bytes memory b = bytes(prefix);
        if (a.length < b.length) return false;
        for (uint256 i = 0; i < b.length; ++i) {
            if (a[i] != b[i]) return false;
        }
        return true;
    }

    function _substring(string memory s, uint256 from, uint256 to) internal pure returns (string memory) {
        bytes memory a = bytes(s);
        bytes memory out = new bytes(to - from);
        for (uint256 i = from; i < to; ++i) {
            out[i - from] = a[i];
        }
        return string(out);
    }

    function _contains(string memory hay, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(hay);
        bytes memory n = bytes(needle);
        if (n.length == 0 || n.length > h.length) return false;
        for (uint256 i = 0; i + n.length <= h.length; ++i) {
            bool found = true;
            for (uint256 j = 0; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

    function _b64decode(string memory data) internal pure returns (bytes memory) {
        bytes memory d = bytes(data);
        require(d.length % 4 == 0, "bad b64 len");
        uint256 padding = 0;
        if (d.length > 0 && d[d.length - 1] == "=") padding++;
        if (d.length > 1 && d[d.length - 2] == "=") padding++;
        bytes memory out = new bytes((d.length / 4) * 3 - padding);
        uint256 o = 0;
        for (uint256 i = 0; i < d.length; i += 4) {
            uint256 n = (_b64val(d[i]) << 18) | (_b64val(d[i + 1]) << 12) | (_b64val(d[i + 2]) << 6)
                | _b64val(d[i + 3]);
            if (o < out.length) out[o++] = bytes1(uint8(n >> 16));
            if (o < out.length) out[o++] = bytes1(uint8(n >> 8));
            if (o < out.length) out[o++] = bytes1(uint8(n));
        }
        return out;
    }

    function _b64val(bytes1 c) internal pure returns (uint256) {
        if (c >= "A" && c <= "Z") return uint8(c) - uint8(bytes1("A"));
        if (c >= "a" && c <= "z") return uint8(c) - uint8(bytes1("a")) + 26;
        if (c >= "0" && c <= "9") return uint8(c) - uint8(bytes1("0")) + 52;
        if (c == "+") return 62;
        if (c == "/") return 63;
        return 0; // '=' padding
    }
}
