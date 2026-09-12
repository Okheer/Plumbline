import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPublicClient, http, type Abi, type Address } from 'viem';
import { sepolia } from 'viem/chains';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const deployment=(name:string)=>JSON.parse(readFileSync(root+`packages/contracts/abi/ensv2/${name}.json`,'utf8')) as {address:Address;abi:Abi};
const client=createPublicClient({chain:sepolia,transport:http(readFileSync(root+'.secrets/sepolia-rpc-url','utf8').trim(),{retryCount:0,timeout:15000})});
try {
 if(await client.getChainId()!==11155111)throw new Error('Wrong chain');
 const registrar=deployment('ETHRegistrar'),registry=deployment('ETHRegistry');
 const block=await client.getBlockNumber();
 const [available,owner,subregistry]=await Promise.all([
 client.readContract({...registrar,functionName:'isAvailable',args:['plumbline'],blockNumber:block}),
 client.readContract({...registry,functionName:'findOwner',args:['plumbline'],blockNumber:block}),
 client.readContract({...registry,functionName:'getSubregistry',args:['plumbline'],blockNumber:block})]);
 const report={chainId:11155111,block:block.toString(),name:'plumbline.eth',available,owner,subregistry,fundOwner:'0x89cE79730f8a1F4B05B4EF9334ef4f53E237dE20',agentOwner:'0x33a4De190Ffa59deC8260880bc96744D8Ac38177',transactionsSent:false};
 mkdirSync(root+'docs/phase-2',{recursive:true});writeFileSync(root+'docs/phase-2/preflight.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
} catch(e) { console.error('ENS preflight failed:',e instanceof Error?e.name:'Unknown error','(RPC URL omitted)');process.exitCode=1; }
