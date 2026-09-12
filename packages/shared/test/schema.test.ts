import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intentSchema, uint256, int256 } from '../src/index.ts';
const sample={schemaVersion:1,chainId:11155111,intentId:'0x'+'11'.repeat(32),agentNode:'0x'+'22'.repeat(32),signer:'0x'+'33'.repeat(20),tokenIn:'0x'+'44'.repeat(20),tokenOut:'0x'+'55'.repeat(20),amountIn:'1000000000000000000',minAmountOut:'1',maxSlippageBps:50,targetDeltaE18:'-1000000000000000000',mandateVersion:'1',nonce:'0',deadline:'1900000000',referenceBlock:'11690532',referenceBlockHash:'0x'+'66'.repeat(32),referencePriceE18:'1000000000000000000'};
test('intent round-trip preserves amounts above JavaScript safe integer range',()=>assert.deepEqual(intentSchema.parse(JSON.parse(JSON.stringify(sample))),sample));
test('rejects another chain, identical instruments and permissive slippage',()=>{for(const change of [{chainId:1},{tokenOut:sample.tokenIn},{maxSlippageBps:10001},{amountIn:0},{amountIn:'0'},{amountIn:'bad'}])assert.equal(intentSchema.safeParse({...sample,...change}).success,false);});
test('Solidity integer bounds are respected',()=>{assert.equal(uint256.safeParse(((1n<<256n)-1n).toString()).success,true);assert.equal(uint256.safeParse((1n<<256n).toString()).success,false);assert.equal(int256.safeParse((-(1n<<255n)).toString()).success,true);assert.equal(int256.safeParse((1n<<255n).toString()).success,false);});
