// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IAqua} from "../src/aqua/IAqua.sol";
import {AquaXYKMarket} from "../src/aqua/AquaXYKMarket.sol";
import {DemoToken} from "../src/aqua/DemoToken.sol";

interface VmPhase4 {
    function envOr(string calldata key, string calldata defaultValue) external returns (string memory value);
    function createSelectFork(string calldata urlOrAlias) external returns (uint256 forkId);
    function startPrank(address sender) external;
    function stopPrank() external;
}

contract AquaXYKMarketSepoliaTest {
    VmPhase4 private constant vm = VmPhase4(address(uint160(uint256(keccak256("hevm cheat code")))));
    IAqua private constant AQUA = IAqua(0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a);
    DemoToken private constant USDC = DemoToken(0x768F42455A2D082E23ceeF7d51e5787C82d67a39);
    address private constant MAKER = 0x89cE79730f8a1F4B05B4EF9334ef4f53E237dE20;
    address private constant TAKER = 0x33a4De190Ffa59deC8260880bc96744D8Ac38177;

    function testSepoliaForkShipAndFill() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        uint256 takerUsdcBefore = USDC.balanceOf(TAKER);

        vm.startPrank(MAKER);
        DemoToken weth = new DemoToken("Plumbline Mock Wrapped Ether", "pWETH", 18);
        AquaXYKMarket market = new AquaXYKMarket(AQUA);
        weth.mint(MAKER, 10 ether);
        weth.mint(TAKER, 1 ether);
        USDC.mint(MAKER, 20_000e6);
        weth.approve(address(AQUA), type(uint256).max);
        USDC.approve(address(AQUA), type(uint256).max);

        AquaXYKMarket.Strategy memory strategy = AquaXYKMarket.Strategy({
            maker: MAKER,
            token0: address(weth),
            token1: address(USDC),
            feeBps: 30,
            salt: keccak256("plumbline-phase-4-mockweth-usdc-v1")
        });
        address[] memory tokens = new address[](2);
        tokens[0] = address(weth);
        tokens[1] = address(USDC);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10 ether;
        amounts[1] = 20_000e6;
        bytes32 hash = AQUA.ship(address(market), abi.encode(strategy), tokens, amounts);
        vm.stopPrank();

        vm.startPrank(TAKER);
        weth.approve(address(market), 0.1 ether);
        uint256 output = market.swapExactIn(strategy, true, 0.1 ether, 190e6, TAKER);
        vm.stopPrank();

        require(output > 190e6, "quote");
        require(weth.balanceOf(TAKER) == 0.9 ether, "taker input moved");
        require(USDC.balanceOf(TAKER) == takerUsdcBefore + output, "taker output moved");
        (uint256 virtualWeth, uint256 virtualUsdc) =
            AQUA.safeBalances(MAKER, address(market), hash, address(weth), address(USDC));
        require(virtualWeth == 10.1 ether, "Aqua input balance");
        require(virtualUsdc == 20_000e6 - output, "Aqua output balance");
    }
}
