// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
/// @notice Phase 1 ABI only. No execution or permission enforcement implemented yet.
interface IPlumblineDesk {
 struct Intent {
  bytes32 intentId; bytes32 agentNode; address signer; address tokenIn; address tokenOut;
  uint256 amountIn; uint256 minAmountOut; uint16 maxSlippageBps; int256 targetDeltaE18;
  uint256 mandateVersion; uint256 nonce; uint256 deadline;
  uint256 referenceBlock; bytes32 referenceBlockHash; uint256 referencePriceE18;
 }
 event IntentDeclared(bytes32 indexed intentId, bytes32 indexed agentNode, Intent intent);
 event FillRecorded(bytes32 indexed intentId, bytes32 indexed agentNode, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 mandateVersion);
}
