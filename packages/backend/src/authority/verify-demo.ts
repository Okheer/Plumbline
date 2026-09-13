import {readFileSync,writeFileSync} from 'node:fs';
import {createPublicClient,http,type Hex} from 'viem';
import {namehash} from 'viem/ens';
import {deployment} from '../identity/transactions.js';
export async function verifyDemoStep(index:number,hash:Hex){
 const p=JSON.parse(readFileSync('docs/phase-3/migration-plan.json','utf8'));
 const a=JSON.parse(readFileSync('docs/phase-3/adapter-deployment.json','utf8'));
 const artifact=JSON.parse(readFileSync('packages/contracts/out/ENSAuthorityAdapter.sol/ENSAuthorityAdapter.json','utf8'));
 const c=createPublicClient({transport:http(readFileSync('.secrets/sepolia-rpc-url','utf8').trim())});
 const receipt=await c.getTransactionReceipt({hash});if(receipt.status!=='success')throw Error('Demo transaction reverted');
 const blockNumber=receipt.blockNumber,node=namehash(p.name),r=deployment('PermissionedResolverImpl');
 const active=await c.readContract({address:a.address,abi:artifact.abi,functionName:'isAuthorized',args:[node,p.agent],blockNumber});
 if(active!==(index===1||index===2))throw Error('Unexpected live authority state');
 const version=await c.readContract({address:p.resolver,abi:r.abi,functionName:'text',args:[node,'plumbline.mandate.version'],blockNumber});
 const cap=await c.readContract({address:p.resolver,abi:r.abi,functionName:'text',args:[node,'plumbline.mandate.maxNotionalQuoteE18'],blockNumber});
 if(version!==(index>=2?'2':'1')||cap!==(index>=2?'200000000000000000000':'100000000000000000000'))throw Error('Unexpected mandate record');
 writeFileSync('docs/phase-3/demo-step-'+index+'.json',JSON.stringify({hash,block:blockNumber.toString(),active,version,cap},null,2));
}
