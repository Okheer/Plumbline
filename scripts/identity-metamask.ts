import { matchesIdentityTransaction } from '../packages/backend/src/identity/receipt-match.ts';
// Local signing utility for Phase 2; no wallet keys enter this process.
import { parseArgs } from 'node:util';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createPublicClient, http, getAddress, encodeFunctionData, toHex, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { namehash, labelhash, packetToBytes } from 'viem/ens';
import { deployment, deployRegistry, deployAgentResolver, registerChild, parentLink, zeroAddress, type Transaction } from '../packages/backend/src/identity/transactions.ts';
import { commitmentArgs, commitRegistration, revealRegistration } from '../packages/backend/src/identity/registration.ts';
const owner='0x89cE79730f8a1F4B05B4EF9334ef4f53E237dE20' as Address;
const {values}=parseArgs({options:{'mint-agent':{type:'string'},'agent-owner':{type:'string'},'prepare-only':{type:'boolean'}}});
const mintLabel=values['mint-agent'];
if(mintLabel&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(mintLabel))throw new Error('Use a lowercase ASCII agent label');
if(mintLabel&&!values['agent-owner'])throw new Error('Provide --agent-owner public address');
const agent=getAddress(values['agent-owner']||'0x33a4De190Ffa59deC8260880bc96744D8Ac38177');
const full=(mintLabel||'agent-01')+'.momentum.plumbline.eth';
const rpc=readFileSync('.secrets/sepolia-rpc-url','utf8').trim();
const client=createPublicClient({chain:sepolia,transport:http(rpc,{retryCount:0,timeout:20000})});
type Step=Transaction & {from:Address;hash?:Hex};
type State={steps:Step[];index:number;created:number;verified?:boolean};
const path=mintLabel?'.secrets/identity-mint-'+mintLabel+'-'+agent.toLowerCase()+'.json':'.secrets/identity-registration.json';
const save=()=>writeFileSync(path,JSON.stringify(state,null,2)+'\n',{mode:0o600});
let state:State;
if(await client.getChainId()!==11155111)throw new Error('RPC must be Sepolia');
if(existsSync(path))state=JSON.parse(readFileSync(path,'utf8'));
else if(mintLabel){
 const registry=deployment('UserRegistryImpl');
 const fund=await client.readContract({...deployment('ETHRegistry'),functionName:'getSubregistry',args:['plumbline']}) as Address;
 const strategy=await client.readContract({address:fund,abi:registry.abi,functionName:'getSubregistry',args:['momentum']}) as Address;
 const parent=await client.readContract({address:fund,abi:registry.abi,functionName:'getState',args:[BigInt(labelhash('momentum'))]}) as {expiry:bigint};
 if(parent.expiry<=(await client.getBlock()).timestamp)throw new Error('Strategy name expired');
 if(await client.readContract({address:strategy,abi:registry.abi,functionName:'findOwner',args:[mintLabel]})!==zeroAddress)throw new Error('Agent name already owned');
 const tx=deployAgentResolver(agent,full,'momentum',BigInt(toHex(randomBytes(32))));
 const result=await client.call({account:agent,to:tx.to,data:tx.data});
 if(!result.data||result.data.length!==66)throw new Error('Invalid factory address');
 const resolver=('0x'+result.data.slice(-40)) as Address;
 state={steps:[{...tx,from:agent},{...registerChild(strategy,mintLabel,agent,zeroAddress,resolver,parent.expiry),from:owner}],index:0,created:Date.now()};save();
}
else {
 const steps:Step[]=[];
 const add=(tx:Transaction,from:Address=owner)=>steps.push({...tx,from});
 const salt=()=>BigInt(toHex(randomBytes(32)));
 async function proxy(tx:Transaction,from:Address=owner){
  const result=await client.call({account:from,to:tx.to,data:tx.data});
  if(!result.data || result.data.length!==66)throw new Error('Factory returned invalid proxy address');
  add(tx,from);return ('0x'+result.data.slice(-40)) as Address;
 }
 const registrar=deployment('ETHRegistrar'),token=deployment('MockUSDC');
 if(!await client.readContract({...registrar,functionName:'isAvailable',args:['plumbline']}))throw new Error('plumbline.eth is unavailable; do not create a replacement name');
 const duration=2419200n;
 const fund=await proxy(deployRegistry(owner,salt()));
 const strategy=await proxy(deployRegistry(owner,salt()));
 const fundResolver=await proxy(deployAgentResolver(owner,'plumbline.eth','fund',salt(),'fund'));
 const strategyResolver=await proxy(deployAgentResolver(owner,'momentum.plumbline.eth','momentum',salt(),'strategy'));
 const resolver=await proxy(deployAgentResolver(agent,full,'momentum',salt()),agent);
 const oracle=await client.readContract({...registrar,functionName:'rentPriceOracle'}) as Address;
 if(!await client.readContract({address:oracle,abi:deployment('StandardRentPriceOracle').abi,functionName:'isPaymentToken',args:[token.address]}))throw new Error('MockUSDC is not accepted');
 const [base,premium]=await client.readContract({...registrar,functionName:'getRegisterPrice',args:['plumbline',duration,token.address]}) as [bigint,bigint];
 const balance=await client.readContract({...token,functionName:'balanceOf',args:[owner]}) as bigint;
 const cost=base+premium;
 if(balance<cost)add({to:token.address,data:encodeFunctionData({abi:token.abi,functionName:'mint',args:[owner,cost-balance]}),value:'0',description:`Mint ${cost-balance} base units of ENS mock USDC (test tokens)`});
 add({to:token.address,data:encodeFunctionData({abi:token.abi,functionName:'approve',args:[registrar.address,cost]}),value:'0',description:`Approve exactly ${cost} base units of mock USDC for registration`});
 const registration={label:'plumbline',owner,secret:toHex(randomBytes(32)),subregistry:fund,resolver:fundResolver,duration};
 const commitment=await client.readContract({...registrar,functionName:'makeCommitment',args:commitmentArgs(registration)}) as Hex;
 add(commitRegistration(commitment));add(revealRegistration(registration,token.address));
 add(parentLink(fund,deployment('ETHRegistry').address,'plumbline'));
 // Child leases are bounded by a timestamp earlier than the root's eventual expiry.
 const expiry=(await client.getBlock()).timestamp+duration;
 add(registerChild(fund,'momentum',owner,strategy,strategyResolver,expiry));
 add(parentLink(strategy,fund,'momentum'));
 add(registerChild(strategy,'agent-01',agent,zeroAddress,resolver,expiry));
 state={steps,index:0,created:Date.now()};mkdirSync('.secrets',{recursive:true,mode:0o700});save();
}
if(values['prepare-only']){console.log(JSON.stringify({name:full,steps:state.steps.length,transactionsSent:false}));process.exit(0);}
const auth=randomBytes(24).toString('hex');
const origin='http://127.0.0.1:3312';
let busy=false;
async function verify(){
 const universal=deployment('UniversalResolverV2'),abi=deployment('PermissionedResolverImpl').abi;
 for(const [name,address] of [['plumbline.eth',owner],['momentum.plumbline.eth',owner],[full,agent]]){
  const result=await client.readContract({...universal,functionName:'resolve',args:[toHex(packetToBytes(name)),encodeFunctionData({abi,functionName:'addr',args:[namehash(name)]})]});
  if(!JSON.stringify(result).toLowerCase().includes(address.slice(2).toLowerCase()))throw new Error('ENS resolution mismatch');
 }
 const result=await client.readContract({...universal,functionName:'resolve',args:[toHex(packetToBytes(full)),encodeFunctionData({abi,functionName:'text',args:[namehash(full),'agent-context']})]});
 // Preserve raw response and receipts as live evidence, without the registration secret.
 mkdirSync('docs/phase-2',{recursive:true});writeFileSync(mintLabel?'docs/phase-2/live-mint-'+mintLabel+'.json':'docs/phase-2/live-registration.json',JSON.stringify({chainId:11155111,name:full,verifiedAt:new Date().toISOString(),identityResponse:result,transactions:state.steps.map(s=>({description:s.description,hash:s.hash}))},null,2));
 state.verified=true;save();
}
const page=`<!doctype html><meta charset="utf-8"><title>Plumbline Sepolia registration</title><h1>Phase 2: ENS registration</h1><p>${full} · Sepolia · ${mintLabel ? "expires with its strategy" : "28-day root registration"}</p><p>Keep this page open. Each transaction requires your approval in MetaMask. Select the wallet address shown below. After the commitment, wait at least 60 seconds before retrying the reveal.</p><pre id="status"></pre><button id="next">Review next transaction</button><script>
const token=location.hash.slice(1)||sessionStorage.getItem('plumbline-session');if(token)sessionStorage.setItem('plumbline-session',token);history.replaceState(null,'',location.pathname);const status=document.querySelector('#status'),button=document.querySelector('#next');
const wallets=new Map();
window.addEventListener('eip6963:announceProvider',e=>{wallets.set(e.detail.info.rdns,e.detail.provider);});
window.dispatchEvent(new Event('eip6963:requestProvider'));
async function getMetaMask(){
 window.dispatchEvent(new Event('eip6963:requestProvider'));
 await new Promise(resolve=>setTimeout(resolve,300));
 const provider=wallets.get('io.metamask');
 if(!provider)throw Error('MetaMask was not detected. Enable its extension for this page and reload.');
 return provider;
}
async function api(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Session':token},body:JSON.stringify(body||{})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
button.onclick=async()=>{button.disabled=true;try{const pendingHash=localStorage.getItem('plumbline-pending');if(pendingHash){await api('/receipt',{hash:pendingHash});localStorage.removeItem('plumbline-pending');}const d=await api('/next');if(d.done){status.textContent='Complete: live ENS names resolved. Return to Codex.';return;}status.textContent=d.position+'\\n'+d.step.description+'\\nWallet: '+d.step.from+'\\nContract: '+d.step.to;
const ethereum=await getMetaMask();
await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xaa36a7'}]});
let accounts=await ethereum.request({method:'eth_requestAccounts'});
if(!accounts.some(a=>a.toLowerCase()===d.step.from.toLowerCase())){
 await ethereum.request({method:'wallet_requestPermissions',params:[{eth_accounts:{}}]});
 accounts=await ethereum.request({method:'eth_accounts'});
}
status.textContent+='\\nConnected through MetaMask: '+accounts.join(', ');
if(!accounts.some(a=>a.toLowerCase()===d.step.from.toLowerCase()))throw Error('The required wallet is not connected to this site. In MetaMask permissions, connect the address shown above.');
if(!confirm(d.step.description+'\\nSepolia only. Continue to MetaMask?'))return;
const hash=await ethereum.request({method:'eth_sendTransaction',params:[{from:d.step.from,to:d.step.to,data:d.step.data,value:'0x0'}]});
localStorage.setItem('plumbline-pending',hash);await api('/receipt',{hash});localStorage.removeItem('plumbline-pending');status.textContent='Confirmed. Click to review the next transaction.';
}catch(e){status.textContent+='\\n'+e.message;}finally{button.disabled=false;}};
const pending=localStorage.getItem('plumbline-pending');if(pending)api('/receipt',{hash:pending}).then(()=>{localStorage.removeItem('plumbline-pending');status.textContent='Previous transaction recovered.'}).catch(e=>status.textContent=e.message);
</script>`;
createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");
 const reply=(code:number,data:unknown)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 if(req.headers.host!=='127.0.0.1:3312'){reply(403,{error:'Invalid host'});return;}
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(page);return;}
 if(req.method!=='POST'||req.headers['x-session']!==auth||req.headers.origin!==origin){reply(403,{error:'Invalid session'});return;}
 if(busy){reply(409,{error:'A transaction check is already running'});return;}busy=true;
 try{
  let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)throw new Error('Request too large');}
  const step=state.steps[state.index];
  if(req.url==='/receipt'){
   const {hash}=JSON.parse(body);if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Invalid transaction');
   if(state.steps.some(s=>s.hash?.toLowerCase()===hash.toLowerCase())){reply(200,{confirmed:true});return;}
   if(!step)throw new Error('No pending step');
   const tx=await client.getTransaction({hash});
   if(!matchesIdentityTransaction(tx,step))throw new Error('Transaction does not match the expected step');
   const receipt=await client.waitForTransactionReceipt({hash,timeout:45000});if(receipt.status!=='success')throw new Error('Transaction reverted');
   step.hash=hash;state.index++;save();reply(200,{confirmed:true});
  }else if(req.url==='/next'){
   if(!step){await verify();reply(200,{done:true});}
   else {await client.call({account:step.from,to:step.to,data:step.data,value:0n});reply(200,{position:`Step ${state.index+1} of ${state.steps.length}`,step});}
  }else reply(404,{error:'Unknown endpoint'});
 }catch(e){reply(400,{error:e instanceof Error && !e.message.includes(rpc) && e.message.length<200?e.message:'Sepolia check failed. If this is the reveal step, wait 60 seconds after commitment and retry. No step was advanced.'});}
 finally{busy=false;}
}).listen(3312,'127.0.0.1',()=>console.log(`Open in your MetaMask browser: ${origin}/#${auth}`));
