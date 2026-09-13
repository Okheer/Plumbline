// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IAqua} from "./IAqua.sol";

interface IERC20Like {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice A small constant-product maker app for Phase 4 Aqua liquidity.
/// @dev Phase 5 will route agent execution through SwapVM and enforce ENS authority.
contract AquaXYKMarket {
    struct Strategy {
        address maker;
        address token0;
        address token1;
        uint16 feeBps;
        bytes32 salt;
    }

    IAqua public immutable AQUA;
    bool private entered;

    error InvalidStrategy();
    error ReentrantSwap();
    error InsufficientOutput(uint256 actual, uint256 minimum);
    error TokenTransferFailed();

    event Swap(
        address indexed maker,
        address indexed taker,
        bytes32 indexed strategyHash,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(IAqua aqua_) {
        require(address(aqua_) != address(0), "zero Aqua");
        AQUA = aqua_;
    }

    function strategyHash(Strategy calldata strategy) public pure returns (bytes32) {
        return keccak256(abi.encode(strategy));
    }

    function quoteExactIn(Strategy calldata strategy, bool zeroForOne, uint256 amountIn)
        external
        view
        returns (uint256 amountOut)
    {
        _validate(strategy);
        bytes32 hash = strategyHash(strategy);
        (address tokenIn, address tokenOut) =
            zeroForOne ? (strategy.token0, strategy.token1) : (strategy.token1, strategy.token0);
        (uint256 balanceIn, uint256 balanceOut) =
            AQUA.safeBalances(strategy.maker, address(this), hash, tokenIn, tokenOut);
        return _quote(balanceIn, balanceOut, amountIn, strategy.feeBps);
    }

    function swapExactIn(
        AquaXYKMarket.Strategy calldata strategy,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external returns (uint256 amountOut) {
        if (entered) revert ReentrantSwap();
        entered = true;
        _validate(strategy);
        bytes32 hash = strategyHash(strategy);
        (address tokenIn, address tokenOut) =
            zeroForOne ? (strategy.token0, strategy.token1) : (strategy.token1, strategy.token0);
        (uint256 balanceIn, uint256 balanceOut) =
            AQUA.safeBalances(strategy.maker, address(this), hash, tokenIn, tokenOut);
        amountOut = _quote(balanceIn, balanceOut, amountIn, strategy.feeBps);
        if (amountOut < amountOutMin) revert InsufficientOutput(amountOut, amountOutMin);

        if (!IERC20Like(tokenIn).transferFrom(msg.sender, address(this), amountIn)) revert TokenTransferFailed();
        if (!IERC20Like(tokenIn).approve(address(AQUA), amountIn)) revert TokenTransferFailed();
        AQUA.push(strategy.maker, address(this), hash, tokenIn, amountIn);
        AQUA.pull(strategy.maker, hash, tokenOut, amountOut, recipient);
        entered = false;
        emit Swap(strategy.maker, msg.sender, hash, tokenIn, tokenOut, amountIn, amountOut);
    }

    function _validate(Strategy calldata strategy) private pure {
        if (
            strategy.maker == address(0) || strategy.token0 == address(0) || strategy.token1 == address(0)
                || strategy.token0 == strategy.token1 || strategy.feeBps > 1_000
        ) revert InvalidStrategy();
    }

    function _quote(uint256 balanceIn, uint256 balanceOut, uint256 amountIn, uint16 feeBps)
        private
        pure
        returns (uint256)
    {
        uint256 amountInWithFee = amountIn * (10_000 - feeBps);
        return amountInWithFee * balanceOut / (balanceIn * 10_000 + amountInWithFee);
    }
}
