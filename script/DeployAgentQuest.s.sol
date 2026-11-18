// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AgentQuest} from "../src/AgentQuest.sol";

/// @title Deploy AgentQuest to BNB Chain mainnet (chain id 56)
/// @notice PREPARED ONLY — DO NOT RUN without the user's explicit go-ahead and a
/// funded deployer key. Deployment costs ~0.0002–0.0005 BNB in gas.
/// @dev The Binance Agentic Wallet CLI (baw) CANNOT deploy contracts: it has no
/// deploy command and `contract-call` requires a `--to` target contract, while
/// a deployment transaction has no `to` address. Deploy with a separate EOA
/// key via forge (below), funded with a small amount of BNB.
///
/// Run (from the project root, after exporting DEPLOYER_PRIVATE_KEY):
///   forge script script/DeployAgentQuest.s.sol \
///     --rpc-url https://bsc-dataseed.bnbchain.org \
///     --broadcast --private-key $DEPLOYER_PRIVATE_KEY \
///     --verify --verifier-url https://api.bscscan.com/api \
///     --etherscan-api-key $BSCSCAN_API_KEY
///
/// Dry-run first (no broadcast, no spend):
///   forge script script/DeployAgentQuest.s.sol \
///     --rpc-url https://bsc-dataseed.bnbchain.org
contract DeployAgentQuest is Script {
    /// @dev Canonical SPACE ID Agent ID registry on BNB Chain.
    address internal constant AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;

    function run() external {
        address[] memory curated = new address[](30);
        curated[0] = 0x409Cfe3747f1ac20f267B50BCbB6a4E9406DA3a8; // sidecoo Daily (29,373 minted)
        curated[1] = 0xc267E47F1Ba3B6B2BCbA58f16298c92CaCAF7952; // Pilot Boarding Pass (25,026)
        curated[2] = 0xDd8BdfC91cbD572935B09863A742d8296fed0ACf; // Nemotron Sigil (17,553)
        curated[3] = 0xe887584746A1375d732854b3B67460a2A73ae0a9; // LeadLoop (10,000)
        curated[4] = 0x6b1D77D3DeDE3FC775ca8C7BDe08C2C2EAAb9BEA; // HIRELINGS (10,000)
        curated[5] = 0x828e7073Ef57Ed778E4acF82cC45BC43eF760b54; // HashOre (10,000)
        curated[6] = 0xcBe2DBBFF4264Dc67Bf557c64e29997B82439354; // Binance Agent Oracle (9,202)
        curated[7] = 0xBf3488E453c68e9771C26D448E99d0EC5395135f; // Agentlings (8,851)
        curated[8] = 0x6af0307E75B8153340E2723c1468a2412a160080; // CactiCore (7,298)
        curated[9] = 0x4c1A7eA2070f0ADF833e28d7FE8e1b8F62CF27F8; // Glyphora (7,296)
        curated[10] = 0xd584D5CD6A28Af35f52aE90c4B436132858fc36D; // MothWire (7,164)
        curated[11] = 0x05deBE4445232205AE7E79d02cb5DE5AA0641efF; // Tacotron (7,008)
        curated[12] = 0x1c759C4e075103b5B250DB5114B832b17B99C456; // The Claf Eye (6,988)
        curated[13] = 0xCe67038f8703Dff3Aadaf77d41823b4b039C9446; // Agent Miner (6,403)
        curated[14] = 0x993C822E7d9bBC75aa6b5095bD90a011Ff38cF71; // SYMBOL (6,220)
        curated[15] = 0x3Aeda314ec05BC22E3c26a543E16Df2B8cC8fe69; // Agent Cosmos (5,349)
        curated[16] = 0xbC95E0a5Bb1305958Ba3263C6E9943b7A2554757; // Voltoad (5,195)
        curated[17] = 0xbF18B0CfDd9e4FD138a362A92F29674197Fdb886; // Agent Apes (5,126)
        curated[18] = 0x08b1A979Dd997492EEcc010fe986eA2e2925e620; // PassAgentX (5,100)
        curated[19] = 0x8cc691D0EEf7870460e2886Aa1075bF3468710a2; // Kitesy (4,206)
        curated[20] = 0x6A4847Cb5f658943222FBd23D2520049F824789d; // Ghostling (4,171)
        curated[21] = 0x9B0c237A123277fCf8768550Bbdd7767C73Cf5D3; // AGENTONE Hero (4,168)
        curated[22] = 0x4e4e43f84E2E80716d03153F3c675e8E715Fa698; // Pixel Sentinels (4,132)
        curated[23] = 0x8d0f3FCdaec965120C53a753a456Ed85A6624aD3; // Arcadion (3,563)
        curated[24] = 0xa340ba0FeAcBBD17cBb1622C4d33Ed32720E1F83; // Peachling (3,545)
        curated[25] = 0x6E159c9CD56BeadB523B80d195DdE39C042a1D48; // Foxglow (3,329)
        curated[26] = 0x4673c787Fb192285a7eCD69860503CA3e95bD765; // Polar Bear (3,320)
        curated[27] = 0xB95531Eb859c556B7c9521a99B7b67BA12519564; // Dropnix (3,227)
        curated[28] = 0x072109f54dCca581e45C6FF3516e6Af9BDcbdc60; // Bobaloo (3,216)
        curated[29] = 0x04f3E2A5c4883c67F732Dff38DCA137F41122C62; // Jalopix (3,134)

        vm.startBroadcast();
        AgentQuest quest = new AgentQuest(AGENT_ID, curated);
        vm.stopBroadcast();
        require(address(quest) != address(0), "deploy failed");
    }
}
