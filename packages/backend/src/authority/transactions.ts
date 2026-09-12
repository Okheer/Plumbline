import {encodeFunctionData,toHex,type Address} from 'viem';
import {namehash,packetToBytes} from 'viem/ens';
import {deployment,registryOwnerRoles,type Transaction} from '../identity/transactions.js';
export const AGENT_ACTIVE=1n<<40n;
export const AGENT_ACTIVE_ADMIN=AGENT_ACTIVE<<128n;
export const mandateKeys=['version','maxSlippageBps','maxNotionalQuoteE18','instrumentWhitelist','maxOracleAgeSeconds'].map(k=>'plumbline.mandate.'+k);
export const demoLimits={maxSlippageBps:50,maxNotionalQuoteE18:'100000000000000000000',maxOracleAgeSeconds:'300'};
export function lifecycle(registry:Address,resource:bigint,signer:Address,active:boolean):Transaction {
 if(resource===0n)throw new Error('Lifecycle must target an individual ENS resource');
 return {to:registry,data:encodeFunctionData({abi:deployment('UserRegistryImpl').abi,functionName:active?'grantRoles':'revokeRoles',args:[resource,AGENT_ACTIVE,signer]}),value:'0',description:active?'Grant bounded agent trading authority':'Revoke agent trading authority'};
}
export function authorityRegistry(owner:Address,salt:bigint):Transaction {
 const impl=deployment('UserRegistryImpl'),factory=deployment('VerifiableFactory');
 const init=encodeFunctionData({abi:impl.abi,functionName:'initialize',args:[owner,registryOwnerRoles|AGENT_ACTIVE_ADMIN]});
 return {to:factory.address,data:encodeFunctionData({abi:factory.abi,functionName:'deployProxy',args:[impl.address,salt,init]}),value:'0',description:'Deploy strategy registry with allocator trading-role admin'};
}
// Apply as one multicall signed by the current agent resolver administrator.
// Explicit record permissions survive removal of the overly broad root text roles.
export function scopeResolver(resolver:Address,name:string,agent:Address,allocator:Address):Transaction {
 const abi=deployment('PermissionedResolverImpl').abi,dns=toHex(packetToBytes(name));
 const setters=[...mandateKeys.map(key=>encodeFunctionData({abi,functionName:'authorizeTextRoles',args:[dns,key,allocator,true]})),
 ...['agent-context','agent-endpoint[mcp]','agent-endpoint[a2a]','agent-endpoint[web]'].map(key=>encodeFunctionData({abi,functionName:'authorizeTextRoles',args:[dns,key,agent,true]})),
 encodeFunctionData({abi,functionName:'revokeRootRoles',args:[16n|(16n<<128n),agent]})];
 return {to:resolver,data:encodeFunctionData({abi,functionName:'multicall',args:[setters]}),value:'0',description:'Separate agent identity keys from allocator-only mandate keys'};
}
export function mandateRecords(resolver:Address,name:string,version:bigint,whitelist:Address[]):Transaction {
 if(version<=0n||!whitelist.length)throw new Error('Require a positive version and explicit instrument whitelist');
 const abi=deployment('PermissionedResolverImpl').abi,node=namehash(name);
 const values=[version.toString(),String(demoLimits.maxSlippageBps),demoLimits.maxNotionalQuoteE18,JSON.stringify(whitelist),demoLimits.maxOracleAgeSeconds];
 return {to:resolver,data:encodeFunctionData({abi,functionName:'multicall',args:[mandateKeys.map((key,i)=>encodeFunctionData({abi,functionName:'setText',args:[node,key,values[i]]}))]}),value:'0',description:'Write demo mandate with explicit instruments'};
}
