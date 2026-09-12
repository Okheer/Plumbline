import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createPublicClient,http,encodeFunctionData,decodeFunctionResult,toHex,type Hex,type Address} from 'viem';
import {namehash,packetToBytes} from 'viem/ens';
import {sepolia} from 'viem/chains';
import {deployment} from '../packages/backend/src/identity/transactions.ts';
const rpc=readFileSync('.secrets/sepolia-rpc-url','utf8').trim();
try {
 const c=createPublicClient({chain:sepolia,transport:http(rpc,{retryCount:0,timeout:15000})});
 assert.equal(await c.getChainId(),11155111);
 const blockNumber=await c.getBlockNumber(),u=deployment('UniversalResolverV2'),r=deployment('PermissionedResolverImpl');
 const owner='0x89cE79730f8a1F4B05B4EF9334ef4f53E237dE20',agent='0x33a4De190Ffa59deC8260880bc96744D8Ac38177';
 const rows=[];
 for(const [name,address,role] of [['plumbline.eth',owner,'fund'],['momentum.plumbline.eth',owner,'strategy'],['agent-01.momentum.plumbline.eth',agent,'trading-agent']]){
  async function resolve(fn:string,args:unknown[]){const out=await c.readContract({...u,functionName:'resolve',args:[toHex(packetToBytes(name)),encodeFunctionData({abi:r.abi,functionName:fn,args})],blockNumber}) as [Hex,Address];return decodeFunctionResult({abi:r.abi,functionName:fn,data:out[0]});}
  const resolved=String(await resolve('addr',[namehash(name)]));assert.equal(resolved.toLowerCase(),address.toLowerCase());
  const identity=JSON.parse(String(await resolve('text',[namehash(name),'agent-context'])));assert.equal(identity.name,name);assert.equal(identity.role,role);assert.equal(identity.chainId,11155111);
  rows.push({name,address:resolved,identity});
 }
 const state=JSON.parse(readFileSync('.secrets/identity-registration.json','utf8'));assert.equal(state.index,state.steps.length);
 for(const step of state.steps){assert(step.hash);assert.equal((await c.getTransactionReceipt({hash:step.hash})).status,'success');}
 const report={chainId:11155111,block:blockNumber.toString(),verifiedAt:new Date().toISOString(),names:rows,transactions:state.steps.map((s:any)=>({description:s.description,hash:s.hash}))};
 mkdirSync('docs/phase-2',{recursive:true});writeFileSync('docs/phase-2/live-registration.json',JSON.stringify(report,null,2)+'\n');state.verified=true;writeFileSync('.secrets/identity-registration.json',JSON.stringify(state,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({result:'PASS',block:report.block,names:rows.map(x=>x.name),successfulReceipts:state.steps.length},null,2));
}catch(e){console.error('Identity verification failed:',e instanceof Error?e.name:'unknown','(provider details omitted)');process.exitCode=1;}
