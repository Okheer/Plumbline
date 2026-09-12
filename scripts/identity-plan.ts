import { parseArgs } from 'node:util';
import { deployRegistry, deployAgentResolver, registerChild, zeroAddress } from '../packages/backend/src/identity/transactions.ts';
import { getAddress } from 'viem';
const {values}=parseArgs({options:{action:{type:'string'},owner:{type:'string'},salt:{type:'string'},name:{type:'string'},strategy:{type:'string'},registry:{type:'string'},resolver:{type:'string'},expiry:{type:'string'}}});
function required(key:keyof typeof values){const value=values[key];if(!value)throw new Error(`Missing --${key}`);return value;}
try {
 const owner=getAddress(required('owner'));let tx;
 if(values.action==='registry')tx=deployRegistry(owner,BigInt(required('salt')));
 else if(values.action==='resolver')tx=deployAgentResolver(owner,required('name'),required('strategy'),BigInt(required('salt')));
 else if(values.action==='register-agent')tx=registerChild(getAddress(required('registry')),required('name'),owner,zeroAddress,getAddress(required('resolver')),BigInt(required('expiry')));
 else throw new Error('Use --action registry, resolver, or register-agent');
 console.log(JSON.stringify({chainId:11155111,transaction:tx,broadcast:false},null,2));
} catch(e){console.error(e instanceof Error?e.message:'Invalid input');process.exitCode=1;}
