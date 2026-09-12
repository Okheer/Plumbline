import { z } from 'zod';
export const CHAIN_ID = 11155111 as const;
export const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
export const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
// Decimal strings preserve uint256/int256 precision across JSON and languages.
const MAX_UINT256 = (1n << 256n) - 1n;
export const uint256 = z.string().regex(/^(0|[1-9][0-9]*)$/).refine(v => { try { return BigInt(v) <= MAX_UINT256; } catch { return false; } });
export const int256 = z.string().regex(/^(0|-?[1-9][0-9]*)$/).refine(v => { try { const n=BigInt(v); return n >= -(1n<<255n) && n < (1n<<255n); } catch { return false; } });
export const intentSchema = z.object({
  schemaVersion: z.literal(1), chainId: z.literal(CHAIN_ID), intentId: bytes32,
  agentNode: bytes32, signer: address, tokenIn: address, tokenOut: address,
  amountIn: uint256.refine(v => { try { return BigInt(v)>0n; } catch { return false; } }), minAmountOut: uint256.refine(v => { try { return BigInt(v)>0n; } catch { return false; } }),
  maxSlippageBps: z.number().int().min(0).max(10000), targetDeltaE18: int256,
  mandateVersion: uint256, nonce: uint256, deadline: uint256,
  referenceBlock: uint256, referenceBlockHash: bytes32, referencePriceE18: uint256.refine(v => { try { return BigInt(v)>0n; } catch { return false; } }),
}).strict().refine(v=>v.tokenIn.toLowerCase()!==v.tokenOut.toLowerCase(),{message:'Input and output tokens must differ'});
export const fillSchema = z.object({
  schemaVersion:z.literal(1), chainId:z.literal(CHAIN_ID), intentId:bytes32, agentNode:bytes32,
  transactionHash:bytes32, blockNumber:uint256, blockHash:bytes32, logIndex:z.number().int().nonnegative(),
  tokenIn:address, tokenOut:address, amountIn:uint256, amountOut:uint256,
  gasCostWei:uint256, mandateVersion:uint256,
}).strict();
export const mandateSchema=z.object({
  schemaVersion:z.literal(1), agentNode:bytes32, version:uint256,
  active:z.boolean(), maxSlippageBps:z.number().int().min(0).max(10000),
  maxNotionalQuoteE18:uint256, instrumentWhitelist:z.array(address).min(1),
  maxOracleAgeSeconds:uint256,
}).strict();
export type TradeIntent=z.infer<typeof intentSchema>;
export type Fill=z.infer<typeof fillSchema>;
export type Mandate=z.infer<typeof mandateSchema>;
