import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {AquaProtocolContract,Address as AquaAddress,HexString} from '@1inch/aqua-sdk';
import {createPublicClient,decodeEventLog,encodeAbiParameters,encodeDeployData,encodeFunctionData,
 getAddress,http,keccak256,maxUint256,parseAbi,parseAbiParameters,toHex,type Address,type Hex} from 'viem';
import {sepolia} from 'viem/chains';
import {matchesIdentityTransaction} from '../packages/backend/src/identity/receipt-match.ts';

const FUND=getAddress('0x89cE79730f8a1F4B05B4EF9334ef4f53E237dE20');
const TAKER=getAddress('0x33a4De190Ffa59deC8260880bc96744D8Ac38177');
const AQUA=getAddress('0x1111113ccf1426a8e30e2bff5e005d929bf6a90a');
const USDC=getAddress('0x768f42455a2d082e23ceef7d51e5787c82d67a39');
const WETH_LIQUIDITY=10n*10n**18n,USDC_LIQUIDITY=20_000n*10n**6n;
const TAKER_WETH=1n*10n**18n,SWAP_IN=10n**17n,MIN_OUT=190n*10n**6n,FEE_BPS=30;
const salt=keccak256(toHex('plumbline-phase-4-mockweth-usdc-v1'));
const strategyParameters=[{type:'tuple',components:[
 {name:'maker',type:'address'},{name:'token0',type:'address'},{name:'token1',type:'address'},
 {name:'feeBps',type:'uint16'},{name:'salt',type:'bytes32'}
]}] as const;
const erc20Abi=parseAbi([
 'function mint(address to,uint256 amount)',
 'function approve(address spender,uint256 amount) returns (bool)',
 'function balanceOf(address owner) view returns (uint256)'
]);
const {values}=parseArgs({options:{'prepare-only':{type:'boolean'}}});
const rpc=readFileSync('.secrets/sepolia-rpc-url','utf8').trim();
const client=createPublicClient({chain:sepolia,transport:http(rpc,{retryCount:0,timeout:20_000})});
const tokenArtifact=JSON.parse(readFileSync('packages/contracts/out/DemoToken.sol/DemoToken.json','utf8'));
const marketArtifact=JSON.parse(readFileSync('packages/contracts/out/AquaXYKMarket.sol/AquaXYKMarket.json','utf8'));

type Kind='deploy-token'|'deploy-market'|'mint-maker-weth'|'mint-taker-weth'|'mint-maker-usdc'|
 'approve-maker-weth'|'approve-maker-usdc'|'ship'|'approve-taker-weth'|'swap';
type Step={kind:Kind;from:Address;to?:Address;data:Hex;description:string;hash?:Hex};
type State={chainId:11155111;pair:'pWETH/USDC';steps:Step[];index:number;token?:Address;market?:Address;
 baselineUsdcMaker:string;baselineUsdcTaker:string;created:string};
const statePath='.secrets/aqua-phase4.json';
mkdirSync('.secrets',{recursive:true,mode:0o700});
let state:State;
if(existsSync(statePath))state=JSON.parse(readFileSync(statePath,'utf8'));
else{
 const [baselineUsdcMaker,baselineUsdcTaker]=await Promise.all([
  client.readContract({address:USDC,abi:erc20Abi,functionName:'balanceOf',args:[FUND]}),
  client.readContract({address:USDC,abi:erc20Abi,functionName:'balanceOf',args:[TAKER]})
 ]);
 const data=encodeDeployData({abi:tokenArtifact.abi,bytecode:tokenArtifact.bytecode.object as Hex,
  args:['Plumbline Mock Wrapped Ether','pWETH',18]});
 state={chainId:11155111,pair:'pWETH/USDC',index:0,created:new Date().toISOString(),
  baselineUsdcMaker:baselineUsdcMaker.toString(),baselineUsdcTaker:baselineUsdcTaker.toString(),steps:[
  {kind:'deploy-token',from:FUND,data,description:'Deploy Sepolia-only Plumbline MockWETH token'}
 ]};
 save();
}
function save(){writeFileSync(statePath,JSON.stringify(state,null,2)+'\n',{mode:0o600});}
if(await client.getChainId()!==11155111)throw new Error('RPC must be Sepolia');
if(await client.getCode({address:AQUA})==='0x')throw new Error('Official Aqua registry is missing on Sepolia');

function marketSteps(token:Address,market:Address):Step[]{
 const strategy=encodeAbiParameters(strategyParameters,
  [{maker:FUND,token0:token,token1:USDC,feeBps:FEE_BPS,salt}]);
 const ship=AquaProtocolContract.buildShipTx(new AquaAddress(AQUA),{
  app:new AquaAddress(market),strategy:new HexString(strategy),amountsAndTokens:[
   {token:new AquaAddress(token),amount:WETH_LIQUIDITY},
   {token:new AquaAddress(USDC),amount:USDC_LIQUIDITY}
  ]
 });
 const tx=(kind:Kind,from:Address,to:Address,data:Hex,description:string):Step=>({kind,from,to,data,description});
 return [
  tx('mint-maker-weth',FUND,token,encodeFunctionData({abi:erc20Abi,functionName:'mint',args:[FUND,WETH_LIQUIDITY]}),'Mint 10 pWETH to the maker wallet'),
  tx('mint-taker-weth',FUND,token,encodeFunctionData({abi:erc20Abi,functionName:'mint',args:[TAKER,TAKER_WETH]}),'Mint 1 pWETH to the taker wallet'),
  tx('mint-maker-usdc',FUND,USDC,encodeFunctionData({abi:erc20Abi,functionName:'mint',args:[FUND,USDC_LIQUIDITY]}),'Mint 20,000 Sepolia MockUSDC to the maker wallet'),
  tx('approve-maker-weth',FUND,token,encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[AQUA,maxUint256]}),'Approve Aqua to access maker pWETH'),
  tx('approve-maker-usdc',FUND,USDC,encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[AQUA,maxUint256]}),'Approve Aqua to access maker MockUSDC'),
  tx('ship',FUND,AQUA,ship.data as Hex,'Ship 10 pWETH and 20,000 MockUSDC as Aqua virtual liquidity'),
  tx('approve-taker-weth',TAKER,token,encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[market,SWAP_IN]}),'Approve exactly 0.1 pWETH for the manual taker swap'),
  tx('swap',TAKER,market,encodeFunctionData({abi:marketArtifact.abi,functionName:'swapExactIn',args:[
   {maker:FUND,token0:token,token1:USDC,feeBps:FEE_BPS,salt},true,SWAP_IN,MIN_OUT,TAKER
  ]}),'Swap 0.1 pWETH for at least 190 MockUSDC against the Aqua position')
 ];
}

function recordDeployment(step:Step,address:Address){
 if(step.kind==='deploy-token'){
  state.token=getAddress(address);
  const data=encodeDeployData({abi:marketArtifact.abi,bytecode:marketArtifact.bytecode.object as Hex,args:[AQUA]});
  state.steps.push({kind:'deploy-market',from:FUND,data,description:'Deploy the Phase 4 Aqua constant-product market'});
 }else if(step.kind==='deploy-market'){
  state.market=getAddress(address);
  state.steps.push(...marketSteps(state.token!,state.market));
 }
}

if(values['prepare-only']){
 console.log(JSON.stringify({chainId:state.chainId,pair:state.pair,nextStep:state.steps[state.index]?.description,
  completed:state.index,totalCurrentlyPrepared:state.steps.length,transactionsSent:false}));
 process.exit(0);
}

const auth=randomBytes(24).toString('hex');
const origin='http://127.0.0.1:3313';
let busy=false;
const page=`<!doctype html><meta charset="utf-8"><title>Plumbline Phase 4</title>
<h1>Phase 4: Aqua liquidity</h1><p>pWETH / MockUSDC · Sepolia</p>
<p>Review every transaction and use the wallet shown. The first eight actions use the fund wallet; the final approval and swap use the agent wallet.</p>
<pre id="status"></pre><button id="next">Review next transaction</button><script>
const token=location.hash.slice(1)||sessionStorage.getItem('plumbline-aqua-session');if(token)sessionStorage.setItem('plumbline-aqua-session',token);history.replaceState(null,'',location.pathname);
const status=document.querySelector('#status'),button=document.querySelector('#next'),wallets=new Map();
window.addEventListener('eip6963:announceProvider',e=>wallets.set(e.detail.info.rdns,e.detail.provider));window.dispatchEvent(new Event('eip6963:requestProvider'));
async function metamask(){window.dispatchEvent(new Event('eip6963:requestProvider'));await new Promise(r=>setTimeout(r,300));const p=wallets.get('io.metamask');if(!p)throw Error('MetaMask was not detected. Enable it for this page and reload.');return p;}
async function api(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Session':token},body:JSON.stringify(body||{})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
button.onclick=async()=>{button.disabled=true;try{const pending=localStorage.getItem('plumbline-aqua-pending');if(pending){await api('/receipt',{hash:pending});localStorage.removeItem('plumbline-aqua-pending');}
const d=await api('/next');if(d.done){status.textContent='Phase 4 transaction sequence verified. Return to Codex for the final on-chain report.';return;}
status.textContent=d.position+'\\n'+d.step.description+'\\nWallet: '+d.step.from+(d.step.to?'\\nContract: '+d.step.to:'');const ethereum=await metamask();await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xaa36a7'}]});let accounts=await ethereum.request({method:'eth_requestAccounts'});if(!accounts.some(a=>a.toLowerCase()===d.step.from.toLowerCase())){await ethereum.request({method:'wallet_requestPermissions',params:[{eth_accounts:{}}]});accounts=await ethereum.request({method:'eth_accounts'});}if(!accounts.some(a=>a.toLowerCase()===d.step.from.toLowerCase()))throw Error('Connect the wallet address shown above in MetaMask permissions.');if(!confirm(d.step.description+'\\nSepolia only. Continue to MetaMask?'))return;
const hash=await ethereum.request({method:'eth_sendTransaction',params:[{from:d.step.from,...(d.step.to?{to:d.step.to}:{}),data:d.step.data,value:'0x0'}]});localStorage.setItem('plumbline-aqua-pending',hash);await api('/receipt',{hash});localStorage.removeItem('plumbline-aqua-pending');status.textContent='Confirmed. Click to review the next transaction.';}catch(e){status.textContent+='\\n'+e.message;}finally{button.disabled=false;}};
const pending=localStorage.getItem('plumbline-aqua-pending');if(pending)api('/receipt',{hash:pending}).then(()=>{localStorage.removeItem('plumbline-aqua-pending');status.textContent='Previous transaction recovered.'}).catch(e=>status.textContent=e.message);
</script>`;

createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");
 const reply=(code:number,data:unknown)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 if(req.headers.host!=='127.0.0.1:3313'){reply(403,{error:'Invalid host'});return;}
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(page);return;}
 if(req.method!=='POST'||req.headers['x-session']!==auth||req.headers.origin!==origin){reply(403,{error:'Invalid session'});return;}
 if(busy){reply(409,{error:'A transaction check is already running'});return;}busy=true;
 try{
  let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)throw new Error('Request too large');}
  const step=state.steps[state.index];
  if(req.url==='/receipt'){
   const {hash}=JSON.parse(body);if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Invalid transaction hash');
   if(state.steps.some(s=>s.hash?.toLowerCase()===hash.toLowerCase())){reply(200,{confirmed:true});return;}
   if(!step)throw new Error('No pending step');const tx=await client.getTransaction({hash});
   const creation=!step.to;
   const matches=creation?(tx.to===null&&tx.from.toLowerCase()===step.from.toLowerCase()&&tx.input.toLowerCase()===step.data.toLowerCase()&&tx.value===0n):matchesIdentityTransaction(tx,{from:step.from,to:step.to!,data:step.data});
   if(!matches)throw new Error('Transaction does not match the expected Phase 4 step');
   const receipt=await client.waitForTransactionReceipt({hash,timeout:90_000});if(receipt.status!=='success')throw new Error('Transaction reverted');
   step.hash=hash;if(creation){if(!receipt.contractAddress)throw new Error('Missing deployed contract address');recordDeployment(step,receipt.contractAddress);}state.index++;save();reply(200,{confirmed:true});
  }else if(req.url==='/next'){
   if(!step){reply(200,{done:true});}
   else{await client.call({account:step.from,to:step.to,data:step.data,value:0n});reply(200,{position:`Step ${state.index+1} of ${state.steps.length}`,step:{description:step.description,from:step.from,to:step.to,data:step.data}});}
  }else reply(404,{error:'Unknown endpoint'});
 }catch(e){const m=e instanceof Error&&e.message.length<240&&!e.message.includes(rpc)?e.message:'Sepolia validation failed; no step was advanced.';reply(400,{error:m});}
 finally{busy=false;}
}).listen(3313,'127.0.0.1',()=>console.log(`Open in your MetaMask browser: ${origin}/#${auth}`));
