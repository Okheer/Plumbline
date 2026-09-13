import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createPublicClient,http,type Address} from 'viem';
import {labelhash} from 'viem/ens';
import {deployment} from '../packages/backend/src/identity/transactions.ts';
import {mandateRecords,promoteMandate,lifecycle} from '../packages/backend/src/authority/transactions.ts';
try {
const path='.secrets/mandate-demo.json';if(existsSync(path))throw Error('Resume existing demo');
const p=JSON.parse(readFileSync('docs/phase-3/migration-plan.json','utf8'));
const c=createPublicClient({transport:http(readFileSync('.secrets/sepolia-rpc-url','utf8').trim())});if(await c.getChainId()!==11155111)throw Error('Wrong chain');
const token=deployment('MockUSDC').address;if(!(await c.getCode({address:token})))throw Error('Missing token code');
const s=await c.readContract({address:p.newRegistry,abi:deployment('UserRegistryImpl').abi,functionName:'getState',args:[BigInt(labelhash('agent-01'))]}) as {resource:bigint};
const steps=[mandateRecords(p.resolver,p.name,1n,[token]),lifecycle(p.newRegistry,s.resource,p.agent,true),promoteMandate(p.resolver,p.name,1n,[token],100000000000000000000n,200000000000000000000n),lifecycle(p.newRegistry,s.resource,p.agent,false)].map(t=>({...t,from:p.owner}));
writeFileSync(path,JSON.stringify({steps,index:0,created:Date.now()},null,2),{mode:0o600});console.log('Prepared 4 transactions: mandate, grant, promotion, revoke. Final authority inactive.');
}catch(e){console.error('Preparation failed:',e instanceof Error?e.name:'unknown','(RPC details omitted)');process.exitCode=1;}
