import {decodeFunctionData,parseAbi,zeroHash,type Hex} from 'viem';
const abi=parseAbi(['function redeemDelegations(bytes[] contexts, bytes32[] modes, bytes[] executions)']);
// MetaMask delegation-framework v1.3.0: one default-mode, revert-on-failure execution.
const manager='0xdb9b1e94b5b69df7e401ddbede43491141047db3';
export function matchesIdentityTransaction(tx:{from:string;to:string|null;input:Hex;value:bigint},step:{from:string;to:string;data:Hex}):boolean {
 if(tx.from.toLowerCase()!==step.from.toLowerCase()||tx.value!==0n)return false;
 if(tx.to?.toLowerCase()===step.to.toLowerCase()&&tx.input.toLowerCase()===step.data.toLowerCase())return true;
 if(tx.to?.toLowerCase()!==manager)return false;
 try{
  const {args}=decodeFunctionData({abi,data:tx.input});
  const [contexts,modes,executions]=args;
  const expected=step.to.toLowerCase()+'0'.repeat(64)+step.data.slice(2).toLowerCase();
  return contexts.length===1&&modes.length===1&&executions.length===1&&modes[0]===zeroHash&&executions[0].toLowerCase()===expected;
 }catch{return false;}
}
