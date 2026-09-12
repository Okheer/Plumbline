import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createPublicClient,http,toHex,encodeFunctionData,type Address} from 'viem';
import {labelhash} from 'viem/ens';
import {deployment,parentLink,zeroAddress} from '../packages/backend/src/identity/transactions.ts';
import {authorityRegistry,scopeResolver} from '../packages/backend/src/authority/transactions.ts';
const path='.secrets/authority-migration.json';
if(existsSync(path))throw new Error('Migration plan already exists; resume it rather than overwrite');
const c=createPublicClient({transport:http(readFileSync('.secrets/sepolia-rpc-url','utf8').trim())});
try{
 if(await c.getChainId()!==11155111)throw new Error('Wrong chain');
 const owner='0x89cE79730f8a1F4B05B4EF9334ef4f53E237dE20' as Address,agent='0x33a4De190Ffa59deC8260880bc96744D8Ac38177' as Address;
 const abi=deployment('UserRegistryImpl').abi;
 const fund=await c.readContract({...deployment('ETHRegistry'),functionName:'getSubregistry',args:['plumbline']}) as Address;
 const old=await c.readContract({address:fund,abi,functionName:'getSubregistry',args:['momentum']}) as Address;
 const existing=await c.readContract({address:old,abi,functionName:'getState',args:[BigInt(labelhash('agent-01'))]}) as {expiry:bigint;latestOwner:Address};
 if(existing.latestOwner.toLowerCase()!==agent.toLowerCase())throw new Error('Agent ownership changed');
 const resolver=await c.readContract({address:old,abi,functionName:'getResolver',args:['agent-01']}) as Address;
 const deploy=authorityRegistry(owner,BigInt(toHex(randomBytes(32))));
 const predicted=await c.call({account:owner,to:deploy.to,data:deploy.data});
 if(!predicted.data||predicted.data.length!==66)throw new Error('Factory prediction failed');
 const next=('0x'+predicted.data.slice(-40)) as Address;
 const steps=[{...deploy,from:owner},
 {to:next,data:encodeFunctionData({abi,functionName:'register',args:['agent-01',agent,zeroAddress,resolver,(1n<<24n)|((1n<<28n)<<128n),existing.expiry]}),value:'0',description:'Recreate the same agent identity in the authority registry',from:owner},
 {...parentLink(next,fund,'momentum'),from:owner},
 {...scopeResolver(resolver,'agent-01.momentum.plumbline.eth',agent,owner),from:agent},
 {to:fund,data:encodeFunctionData({abi,functionName:'setSubregistry',args:[BigInt(labelhash('momentum')),next]}),value:'0',description:'Switch momentum to the tested authority registry; preserve ENS names',from:owner}];
 writeFileSync(path,JSON.stringify({steps,index:0,created:Date.now()},null,2)+'\n',{mode:0o600});
 mkdirSync('docs/phase-3',{recursive:true});writeFileSync('docs/phase-3/migration-plan.json',JSON.stringify({oldRegistry:old,newRegistry:next,resolver,agent,owner,name:'agent-01.momentum.plumbline.eth',expiry:existing.expiry.toString(),steps:steps.map(s=>({description:s.description,from:s.from,to:s.to})),tradingEnabled:false},null,2)+'\n');
 console.log('Prepared 5 migration transactions; names, resolver and expiry preserved; trading remains inactive.');
}catch(e){console.error('Migration preparation failed:',e instanceof Error?e.name:'unknown','(RPC details omitted)');process.exitCode=1;}
