import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createPublicClient, http, formatUnits, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { deployment } from '../packages/backend/src/identity/transactions.ts';
const rpc=process.env.SEPOLIA_RPC_URL || readFileSync('.secrets/sepolia-rpc-url','utf8').trim();
const client=createPublicClient({chain:sepolia,transport:http(rpc,{retryCount:0,timeout:15000})});
try {
 if(await client.getChainId()!==sepolia.id)throw new Error('Wrong chain');
 const registrar=deployment('ETHRegistrar'),token=deployment('MockUSDC');
 const owner='0x89cE79730f8a1F4B05B4EF9334ef4f53E237dE20';
 const blockNumber=await client.getBlockNumber();
 const duration=await client.readContract({...registrar,functionName:'MIN_REGISTER_DURATION',blockNumber}) as bigint;
 const oracle=await client.readContract({...registrar,functionName:'rentPriceOracle',blockNumber}) as Address;
 const [accepted,available,price,balance,decimals,wait]=await Promise.all([
 client.readContract({address:oracle,abi:deployment('StandardRentPriceOracle').abi,functionName:'isPaymentToken',args:[token.address],blockNumber}),
 client.readContract({...registrar,functionName:'isAvailable',args:['plumbline'],blockNumber}),
 client.readContract({...registrar,functionName:'getRegisterPrice',args:['plumbline',duration,token.address],blockNumber}) as Promise<[bigint,bigint]>,
 client.readContract({...token,functionName:'balanceOf',args:[owner],blockNumber}) as Promise<bigint>,
 client.readContract({...token,functionName:'decimals',blockNumber}) as Promise<number>,
 client.readContract({...registrar,functionName:'MIN_COMMITMENT_AGE',blockNumber}) as Promise<bigint>
 ]);
 if(!accepted)throw new Error('Pinned test token is not accepted');
 const cost=price[0]+price[1];
 const report={chainId:sepolia.id,block:blockNumber.toString(),name:'plumbline.eth',agent:'agent-01.momentum.plumbline.eth',available,token:token.address,tokenKind:'ENS MockUSDC test token',durationSeconds:duration.toString(),durationDays:Number(duration)/86400,minimumCommitmentAgeSeconds:wait.toString(),cost:formatUnits(cost,decimals),ownerBalance:formatUnits(balance,decimals),testTokenShortfall:formatUnits(cost>balance?cost-balance:0n,decimals),transactionsSent:false};
 mkdirSync('docs/phase-2',{recursive:true});writeFileSync('docs/phase-2/registration-quote.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
} catch(e){console.error('Registration quote failed:',e instanceof Error?e.name:'Unknown error','(RPC details omitted)');process.exitCode=1;}
