import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createPublicClient,http,encodeDeployData,encodeFunctionData,type Address} from 'viem';
import {labelhash,namehash} from 'viem/ens';
import {deployment} from '../packages/backend/src/identity/transactions.ts';
const rpc=readFileSync('.secrets/sepolia-rpc-url','utf8').trim();
try {
 const c=createPublicClient({transport:http(rpc,{retryCount:0,timeout:15000})});if(await c.getChainId()!==11155111)throw Error('Wrong chain');
 const plan=JSON.parse(readFileSync('docs/phase-3/migration-plan.json','utf8'));
 const state=JSON.parse(readFileSync('.secrets/authority-migration.json','utf8'));if(state.index!==5)throw Error('Migration incomplete');
 for(const s of state.steps)if((await c.getTransactionReceipt({hash:s.hash})).status!=='success')throw Error('Failed migration receipt');
 const abi=deployment('UserRegistryImpl').abi;
 const fund=await c.readContract({...deployment('ETHRegistry'),functionName:'getSubregistry',args:['plumbline']}) as Address;
 const registry=await c.readContract({address:fund,abi,functionName:'getSubregistry',args:['momentum']});if(String(registry).toLowerCase()!==plan.newRegistry.toLowerCase())throw Error('Registry mismatch');
 const agentState=await c.readContract({address:plan.newRegistry,abi,functionName:'getState',args:[BigInt(labelhash('agent-01'))]}) as {latestOwner:Address;expiry:bigint};if(agentState.latestOwner.toLowerCase()!==plan.agent.toLowerCase()||agentState.expiry.toString()!==plan.expiry)throw Error('Identity mismatch');
 const r=deployment('PermissionedResolverImpl');
 await c.call({account:plan.owner,to:plan.resolver,data:encodeFunctionData({abi:r.abi,functionName:'setText',args:[namehash(plan.name),'plumbline.mandate.version','1']})});
 let denied=false;try{await c.call({account:plan.agent,to:plan.resolver,data:encodeFunctionData({abi:r.abi,functionName:'setText',args:[namehash(plan.name),'plumbline.mandate.version','1']})});}catch{denied=true;}if(!denied)throw Error('Agent can edit mandate');
 writeFileSync('docs/phase-3/migration-verification.json',JSON.stringify({verified:true,block:(await c.getBlockNumber()).toString(),registry,owner:agentState.latestOwner,allocatorWriteSimulation:true,agentWriteRejected:true},null,2));
 const path='.secrets/authority-deploy.json';if(existsSync(path))throw Error('Deployment plan already exists; resume it');
 const artifact=JSON.parse(readFileSync('packages/contracts/out/ENSAuthorityAdapter.sol/ENSAuthorityAdapter.json','utf8'));
 const data=encodeDeployData({abi:artifact.abi,bytecode:artifact.bytecode.object,args:[deployment('ETHRegistry').address,plan.owner,'plumbline']});
 writeFileSync(path,JSON.stringify({steps:[{to:'0x0000000000000000000000000000000000000000',creation:true,from:plan.owner,value:'0',data,description:'Deploy ENS authority adapter on Sepolia'}],index:0,created:Date.now()},null,2),{mode:0o600});console.log('Migration verified; adapter deployment prepared. No transactions sent.');
}catch(e){console.error('Preparation failed:',e instanceof Error?e.name:'unknown','(provider details omitted)');process.exitCode=1;}
