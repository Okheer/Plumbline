// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IAqua} from "../src/aqua/IAqua.sol";
import {AquaXYKMarket} from "../src/aqua/AquaXYKMarket.sol";
import {DemoToken} from "../src/aqua/DemoToken.sol";

contract AquaRegistryFixture is IAqua {
    mapping(address => mapping(address => mapping(bytes32 => mapping(address => uint256)))) private balances;
    mapping(address => mapping(address => mapping(bytes32 => uint8))) private counts;

    function ship(address app, bytes calldata strategy, address[] calldata tokens, uint256[] calldata amounts)
        external
        returns (bytes32 hash)
    {
        require(tokens.length == amounts.length && tokens.length > 0, "length");
        hash = keccak256(strategy);
        require(counts[msg.sender][app][hash] == 0, "immutable");
        counts[msg.sender][app][hash] = uint8(tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            balances[msg.sender][app][hash][tokens[i]] = amounts[i];
        }
    }

    function dock(address app, bytes32 hash, address[] calldata tokens) external {
        for (uint256 i; i < tokens.length; ++i) {
            balances[msg.sender][app][hash][tokens[i]] = 0;
        }
        counts[msg.sender][app][hash] = 0;
    }

    function rawBalances(address maker, address app, bytes32 hash, address token)
        external
        view
        returns (uint248, uint8)
    {
        return (uint248(balances[maker][app][hash][token]), counts[maker][app][hash]);
    }

    function safeBalances(address maker, address app, bytes32 hash, address token0, address token1)
        external
        view
        returns (uint256, uint256)
    {
        require(counts[maker][app][hash] > 0, "inactive");
        return (balances[maker][app][hash][token0], balances[maker][app][hash][token1]);
    }

    function push(address maker, address app, bytes32 hash, address token, uint256 amount) external {
        require(msg.sender == app && counts[maker][app][hash] > 0, "app");
        require(DemoToken(token).transferFrom(msg.sender, maker, amount), "push");
        balances[maker][app][hash][token] += amount;
    }

    function pull(address maker, bytes32 hash, address token, uint256 amount, address to) external {
        require(balances[maker][msg.sender][hash][token] >= amount, "virtual balance");
        balances[maker][msg.sender][hash][token] -= amount;
        require(DemoToken(token).transferFrom(maker, to, amount), "pull");
    }
}

contract TakerFixture {
    function approve(DemoToken token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function swap(
        AquaXYKMarket market,
        AquaXYKMarket.Strategy calldata strategy,
        uint256 amountIn,
        uint256 amountOutMin
    ) external returns (uint256) {
        return market.swapExactIn(strategy, true, amountIn, amountOutMin, address(this));
    }
}

contract AquaXYKMarketTest {
    function testShipAndManualTakerFillMovesTokens() public {
        AquaRegistryFixture aqua = new AquaRegistryFixture();
        AquaXYKMarket market = new AquaXYKMarket(aqua);
        TakerFixture taker = new TakerFixture();
        DemoToken token0 = new DemoToken("Wrapped Ether", "WETH", 18);
        DemoToken token1 = new DemoToken("USD Coin", "USDC", 6);
        token0.mint(address(this), 10 ether);
        token0.mint(address(taker), 1 ether);
        token1.mint(address(this), 20_000e6);
        token0.approve(address(aqua), type(uint256).max);
        token1.approve(address(aqua), type(uint256).max);

        AquaXYKMarket.Strategy memory strategy = AquaXYKMarket.Strategy({
            maker: address(this),
            token0: address(token0),
            token1: address(token1),
            feeBps: 30,
            salt: bytes32(uint256(1))
        });
        address[] memory tokens = new address[](2);
        tokens[0] = address(token0);
        tokens[1] = address(token1);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10 ether;
        amounts[1] = 20_000e6;
        aqua.ship(address(market), abi.encode(strategy), tokens, amounts);

        uint256 makerUsdcBefore = token1.balanceOf(address(this));
        taker.approve(token0, address(market), 1 ether);
        uint256 amountOut = taker.swap(market, strategy, 1 ether, 1_800e6);
        require(token1.balanceOf(address(taker)) == amountOut, "taker output");
        require(token1.balanceOf(address(this)) == makerUsdcBefore - amountOut, "maker output moved");
        require(amountOut > 1_800e6, "realistic quote");

        bytes32 hash = keccak256(abi.encode(strategy));
        (uint256 newWeth, uint256 newUsdc) =
            aqua.safeBalances(address(this), address(market), hash, address(token0), address(token1));
        require(newWeth == 11 ether, "Aqua input balance");
        require(newUsdc == 20_000e6 - amountOut, "Aqua output balance");
    }

    function testMinimumOutputProtectsTaker() public {
        AquaRegistryFixture aqua = new AquaRegistryFixture();
        AquaXYKMarket market = new AquaXYKMarket(aqua);
        DemoToken token0 = new DemoToken("A", "A", 18);
        DemoToken token1 = new DemoToken("B", "B", 18);
        token0.mint(address(this), 20 ether);
        token1.mint(address(this), 20 ether);
        token0.approve(address(aqua), type(uint256).max);
        token1.approve(address(aqua), type(uint256).max);
        AquaXYKMarket.Strategy memory strategy =
            AquaXYKMarket.Strategy(address(this), address(token0), address(token1), 30, bytes32(0));
        address[] memory tokens = new address[](2);
        tokens[0] = address(token0);
        tokens[1] = address(token1);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10 ether;
        amounts[1] = 10 ether;
        aqua.ship(address(market), abi.encode(strategy), tokens, amounts);
        token0.approve(address(market), 1 ether);
        (bool ok,) =
            address(market).call(abi.encodeCall(market.swapExactIn, (strategy, true, 1 ether, 2 ether, address(this))));
        require(!ok, "minimum output must revert");
    }
}
