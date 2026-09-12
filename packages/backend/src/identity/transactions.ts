import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodeFunctionData, getAddress, zeroAddress, type Abi, type Address, type Hex } from 'viem';
import { namehash, normalize } from 'viem/ens';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
export function deployment(name:string):{address:Address;abi:Abi}{return JSON.parse(readFileSync(root+`packages/contracts/abi/ensv2/${name}.json`,'utf8'));}
export function label(value:string){const n=normalize(value);if(!n || n.includes('.'))throw new Error('Expected one ENS label');return n;}
export const roles={registrar:1n,setParent:1n<<8n,renew:1n<<16n,setSubregistry:1n<<20n,setResolver:1n<<24n};
// Pinned RegistryRolesLib.sol and PermissionedResolverLib.sol define these nybbles.
const registryOps=roles.registrar|roles.setParent|roles.renew|roles.setSubregistry|roles.setResolver;
export const registryOwnerRoles=registryOps|(registryOps<<128n);
const resolverOps=1n|16n; // address + text; no upgrade or unrelated profile powers
export const resolverOwnerRoles=resolverOps|(resolverOps<<128n);
export type Transaction={to:Address;data:Hex;value:'0';description:string};
export function deployRegistry(owner:Address,salt:bigint):Transaction{
 const impl=deployment('UserRegistryImpl'),factory=deployment('VerifiableFactory');
 const init=encodeFunctionData({abi:impl.abi,functionName:'initialize',args:[getAddress(owner),registryOwnerRoles]});
 return {to:factory.address,data:encodeFunctionData({abi:factory.abi,functionName:'deployProxy',args:[impl.address,salt,init]}),value:'0',description:'Deploy user-owned subname registry'};
}
export function deployAgentResolver(owner:Address,fullName:string,strategy:string,salt:bigint,role: 'fund' | 'strategy' | 'trading-agent' = 'trading-agent'):Transaction{
 const normalized=normalize(fullName),node=namehash(normalized),impl=deployment('PermissionedResolverImpl'),factory=deployment('VerifiableFactory');
 const context=JSON.stringify({name:normalized,role,strategy,chainId:11155111,status:'identity-only',services:[]});
 const setters=[encodeFunctionData({abi:impl.abi,functionName:'setAddr',args:[node,getAddress(owner)]}),encodeFunctionData({abi:impl.abi,functionName:'setText',args:[node,'agent-context',context]})];
 const init=encodeFunctionData({abi:impl.abi,functionName:'initialize',args:[getAddress(owner),resolverOwnerRoles,setters]});
 return {to:factory.address,data:encodeFunctionData({abi:factory.abi,functionName:'deployProxy',args:[impl.address,salt,init]}),value:'0',description:'Deploy agent-owned resolver with ENSIP-26 context'};
}
export function registerChild(registry:Address,child:string,owner:Address,subregistry:Address,resolver:Address,expiry:bigint):Transaction{
 if(expiry<=0n || expiry>=(1n<<64n))throw new Error('Invalid uint64 expiry');
 return {to:getAddress(registry),data:encodeFunctionData({abi:deployment('UserRegistryImpl').abi,functionName:'register',args:[label(child),getAddress(owner),getAddress(subregistry),getAddress(resolver),roles.setSubregistry|roles.setResolver,expiry]}),value:'0',description:'Register child name in existing parent registry'};
}
export function parentLink(registry:Address,parent:Address,child:string):Transaction{return {to:registry,data:encodeFunctionData({abi:deployment('UserRegistryImpl').abi,functionName:'setParent',args:[parent,label(child)]}),value:'0',description:'Link registry to its parent'};}
export {zeroAddress};
