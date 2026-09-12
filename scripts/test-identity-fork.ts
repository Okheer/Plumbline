import assert from 'node:assert/strict';
import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData, toHex, type Hex, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { namehash, packetToBytes } from 'viem/ens';
import { deployRegistry, deployAgentResolver, registerChild, parentLink, deployment, zeroAddress, type Transaction } from '../packages/backend/src/identity/transactions.ts';
import { randomBytes } from 'node:crypto';
import { commitmentArgs, commitRegistration, revealRegistration } from '../packages/backend/src/identity/registration.ts';
const rpc='http://127.0.0.1:18545';
const client=createPublicClient({chain:sepolia,transport:http(rpc)});
const owner='0x89cE79730f8a1F4B05B4EF9334ef4f53E237dE20' as Address;
const agent='0x33a4De190Ffa59deC8260880bc96744D8Ac38177' as Address;
async function local(method:string,params:unknown[]){const res=await fetch(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const data=await res.json();if(data.error)throw new Error(JSON.stringify(data.error));}
for(const address of [owner,agent]){await local('anvil_impersonateAccount',[address]);await local('anvil_setBalance',[address,'0x'+parseEther('10').toString(16)]);}
async function send(tx:Transaction,account:Address=owner){const wallet=createWalletClient({account,chain:sepolia,transport:http(rpc)});const hash=await wallet.sendTransaction({to:tx.to,data:tx.data,value:0n});const receipt=await client.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');return receipt;}
async function proxy(tx:Transaction,account:Address){const result=await client.call({account,to:tx.to,data:tx.data});assert(result.data);const address=('0x'+result.data.slice(-40)) as Address;await send(tx,account);assert.notEqual(await client.getCode({address}),'0x');return address;}
const fund=await proxy(deployRegistry(owner,101n),owner);
const strategy=await proxy(deployRegistry(owner,102n),owner);
const expiry=(await client.getBlock()).timestamp+86400n;
const strategyResolver=await proxy(deployAgentResolver(owner,'fork-test.plumbline.eth','fork-test',105n,'strategy'),owner);
await send(registerChild(fund,'fork-test',owner,strategy,strategyResolver,expiry));
await send(parentLink(strategy,fund,'fork-test'));
const full='agent-test.fork-test.plumbline.eth';
const resolver=await proxy(deployAgentResolver(agent,full,'fork-test',103n),agent);
await send(registerChild(strategy,'agent-test',agent,zeroAddress,resolver,expiry));
const registryABI=deployment('UserRegistryImpl').abi,resolverABI=deployment('PermissionedResolverImpl').abi;
assert.equal((await client.readContract({address:fund,abi:registryABI,functionName:'getSubregistry',args:['fork-test']}))?.toString().toLowerCase(),strategy.toLowerCase());
assert.equal((await client.readContract({address:strategy,abi:registryABI,functionName:'getResolver',args:['agent-test']}))?.toString().toLowerCase(),resolver.toLowerCase());
const context=await client.readContract({address:resolver,abi:resolverABI,functionName:'text',args:[namehash(full),'agent-context']});assert.equal(JSON.parse(String(context)).name,full);
let blocked=false;
try{await client.simulateContract({account:owner,address:resolver,abi:resolverABI,functionName:'setText',args:[namehash(full),'agent-context','unauthorized']});}catch{blocked=true;}
assert(blocked,'Fund owner must not silently control agent resolver records');
// Register a root on the local fork and verify resolution through the canonical ENS tree.
const registrar=deployment('ETHRegistrar'), token=deployment('MockUSDC');
const minimum=await client.readContract({...registrar,functionName:'MIN_REGISTER_DURATION'}) as bigint;
const rootResolver=await proxy(deployAgentResolver(owner,'plumbline.eth','fund',104n,'fund'),owner);
const registration={label:'plumbline',owner,secret:toHex(randomBytes(32)),subregistry:fund,resolver:rootResolver,duration:minimum};
const commitment=await client.readContract({...registrar,functionName:'makeCommitment',args:commitmentArgs(registration)}) as Hex;
const price=await client.readContract({...registrar,functionName:'getRegisterPrice',args:['plumbline',minimum,token.address]}) as [bigint,bigint];
const cost=price[0]+price[1];
await send({to:token.address,data:encodeFunctionData({abi:token.abi,functionName:'mint',args:[owner,cost]}),value:'0',description:'Local fork test token mint'});
await send({to:token.address,data:encodeFunctionData({abi:token.abi,functionName:'approve',args:[registrar.address,cost]}),value:'0',description:'Local fork exact payment approval'});
await send(commitRegistration(commitment));
await assert.rejects(client.call({account:owner,...revealRegistration(registration,token.address),value:0n}));
const age=await client.readContract({...registrar,functionName:'MIN_COMMITMENT_AGE'}) as bigint;
await local('evm_increaseTime',[Number(age)+1]);await local('evm_mine',[]);
await send(revealRegistration(registration,token.address));
await send(parentLink(fund,deployment('ETHRegistry').address,'plumbline'));
const universal=deployment('UniversalResolverV2');
for (const parent of ['plumbline.eth','fork-test.plumbline.eth']) {
 const result=await client.readContract({...universal,functionName:'resolve',args:[toHex(packetToBytes(parent)),encodeFunctionData({abi:resolverABI,functionName:'addr',args:[namehash(parent)]})]});
 assert(JSON.stringify(result).toLowerCase().includes(owner.slice(2).toLowerCase()));
}
const resolved=await client.readContract({...universal,functionName:'resolve',args:[toHex(packetToBytes(full)),encodeFunctionData({abi:resolverABI,functionName:'addr',args:[namehash(full)]})]});
assert(JSON.stringify(resolved).toLowerCase().includes(agent.slice(2).toLowerCase()),'Universal resolver must return agent address');
console.log('PASS: root commit/reveal, exact test-token payment, premature reveal rejection, canonical universal agent resolution (local fork only).');
console.log('PASS: real ENSv2 factory proxies, nested registry links, agent registration, ENSIP-26 record, unauthorized record update rejection (local Sepolia fork only).');
