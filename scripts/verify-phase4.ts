import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createPublicClient,decodeEventLog,encodeAbiParameters,getAddress,http,keccak256,
 parseAbi,parseAbiParameters,toHex,type Address,type Hex} from 'viem';
import {sepolia} from 'viem/chains';

const FUND=getAddress('0x89cE79730f8a1F4B05B4EF9334ef4f53E237dE20');
const TAKER=getAddress('0x33a4De190Ffa59deC8260880bc96744D8Ac38177');
const AQUA=getAddress('0x1111113ccf1426a8e30e2bff5e005d929bf6a90a');
const USDC=getAddress('0x768f42455a2d082e23ceef7d51e5787c82d67a39');
const WETH_LIQUIDITY=10n*10n**18n,USDC_LIQUIDITY=20_000n*10n**6n;
const SWAP_IN=10n**17n,FEE_BPS=30n;
const salt=keccak256(toHex('plumbline-phase-4-mockweth-usdc-v1'));
type VerificationState={
 chainId:number;index:number;token?:Address;market?:Address;baselineUsdcMaker:string;baselineUsdcTaker:string;
 steps:Array<{kind:string;from:Address;to?:Address;data:Hex;description:string;hash?:Hex}>;
};
const publicPath='packages/contracts/deployments/sepolia.phase4.json';
let state:VerificationState;
const publicRecord=existsSync(publicPath)?JSON.parse(readFileSync(publicPath,'utf8')):undefined;
if(publicRecord?.baselineBalances){
 state={chainId:publicRecord.chainId,index:publicRecord.transactions.length,token:publicRecord.mockWeth,
  market:publicRecord.market,baselineUsdcMaker:publicRecord.baselineBalances.mockUsdcMakerBefore,
  baselineUsdcTaker:publicRecord.baselineBalances.mockUsdcTakerBefore,steps:publicRecord.transactions};
}else state=JSON.parse(readFileSync('.secrets/aqua-phase4.json','utf8'));
if(state.chainId!==11155111||!state.token||!state.market||state.index!==state.steps.length)
 throw new Error('Phase 4 signing sequence is incomplete');
const token=getAddress(state.token),market=getAddress(state.market);
const rpc=readFileSync('.secrets/sepolia-rpc-url','utf8').trim();
const client=createPublicClient({chain:sepolia,transport:http(rpc,{retryCount:0,timeout:20_000})});
const erc20Abi=parseAbi([
 'function name() view returns (string)','function symbol() view returns (string)',
 'function decimals() view returns (uint8)','function balanceOf(address) view returns (uint256)',
 'function allowance(address owner,address spender) view returns (uint256)'
]);
const aquaAbi=parseAbi([
 'function safeBalances(address maker,address app,bytes32 strategyHash,address token0,address token1) view returns (uint256 balance0,uint256 balance1)'
]);
const marketArtifact=JSON.parse(readFileSync('packages/contracts/out/AquaXYKMarket.sol/AquaXYKMarket.json','utf8'));
const strategy=encodeAbiParameters([{type:'tuple',components:[
 {name:'maker',type:'address'},{name:'token0',type:'address'},{name:'token1',type:'address'},
 {name:'feeBps',type:'uint16'},{name:'salt',type:'bytes32'}
]}] as const,[{maker:FUND,token0:token,token1:USDC,feeBps:Number(FEE_BPS),salt}]);
const strategyHash=keccak256(strategy);
const expectedOut=SWAP_IN*(10_000n-FEE_BPS)*USDC_LIQUIDITY/
 (WETH_LIQUIDITY*10_000n+SWAP_IN*(10_000n-FEE_BPS));

const [aquaCode,tokenCode,marketCode,marketAqua,name,symbol,decimals,virtual,
 makerWeth,takerWeth,makerUsdc,takerUsdc,makerWethAllowance,makerUsdcAllowance]=await Promise.all([
 client.getCode({address:AQUA}),client.getCode({address:token}),client.getCode({address:market}),
 client.readContract({address:market,abi:marketArtifact.abi,functionName:'AQUA'}),
 client.readContract({address:token,abi:erc20Abi,functionName:'name'}),
 client.readContract({address:token,abi:erc20Abi,functionName:'symbol'}),
 client.readContract({address:token,abi:erc20Abi,functionName:'decimals'}),
 client.readContract({address:AQUA,abi:aquaAbi,functionName:'safeBalances',args:[FUND,market,strategyHash,token,USDC]}),
 client.readContract({address:token,abi:erc20Abi,functionName:'balanceOf',args:[FUND]}),
 client.readContract({address:token,abi:erc20Abi,functionName:'balanceOf',args:[TAKER]}),
 client.readContract({address:USDC,abi:erc20Abi,functionName:'balanceOf',args:[FUND]}),
 client.readContract({address:USDC,abi:erc20Abi,functionName:'balanceOf',args:[TAKER]}),
 client.readContract({address:token,abi:erc20Abi,functionName:'allowance',args:[FUND,AQUA]}),
 client.readContract({address:USDC,abi:erc20Abi,functionName:'allowance',args:[FUND,AQUA]})
]);
if(aquaCode==='0x'||tokenCode==='0x'||marketCode==='0x')throw new Error('Missing deployed bytecode');
if(String(marketAqua).toLowerCase()!==AQUA.toLowerCase())throw new Error('Market points to wrong Aqua registry');
if(name!=='Plumbline Mock Wrapped Ether'||symbol!=='pWETH'||decimals!==18)throw new Error('MockWETH metadata mismatch');
if(virtual[0]!==WETH_LIQUIDITY+SWAP_IN||virtual[1]!==USDC_LIQUIDITY-expectedOut)
 throw new Error('Live Aqua virtual balances do not reflect the manual fill');
if(makerWeth!==WETH_LIQUIDITY+SWAP_IN||takerWeth!==9n*10n**17n)throw new Error('MockWETH did not move as expected');
if(makerUsdc!==BigInt(state.baselineUsdcMaker)+USDC_LIQUIDITY-expectedOut||
 takerUsdc!==BigInt(state.baselineUsdcTaker)+expectedOut)throw new Error('MockUSDC did not move as expected');
if(makerWethAllowance<virtual[0]||makerUsdcAllowance<virtual[1])
 throw new Error('Maker allowances no longer cover the Aqua virtual position');

const receipts=await Promise.all(state.steps.map(async step=>{
 if(!step.hash)throw new Error(`Missing receipt for ${step.kind}`);
 const receipt=await client.getTransactionReceipt({hash:step.hash});
 if(receipt.status!=='success')throw new Error(`Failed receipt for ${step.kind}`);
 return {kind:step.kind,description:step.description,hash:step.hash,blockNumber:receipt.blockNumber.toString()};
}));
const swapStep=state.steps.find(s=>s.kind==='swap')!;
const swapReceipt=await client.getTransactionReceipt({hash:swapStep.hash!});
const marketLog=swapReceipt.logs.find(log=>log.address.toLowerCase()===market.toLowerCase());
if(!marketLog)throw new Error('Swap event is missing');
const decoded=decodeEventLog({abi:marketArtifact.abi,data:marketLog.data,topics:marketLog.topics}) as {eventName:string};
if(decoded.eventName!=='Swap')throw new Error('Unexpected market event');

const report={verifiedAt:new Date().toISOString(),chainId:11155111,aquaRegistry:AQUA,
 market,mockWeth:token,mockUsdc:USDC,maker:FUND,taker:TAKER,
 baselineBalances:{mockUsdcMakerBefore:state.baselineUsdcMaker,mockUsdcTakerBefore:state.baselineUsdcTaker},
 strategy:{strategyHash,feeBps:Number(FEE_BPS),initialMockWeth:WETH_LIQUIDITY.toString(),
  initialMockUsdc:USDC_LIQUIDITY.toString()},
 manualFill:{inputMockWeth:SWAP_IN.toString(),outputMockUsdc:expectedOut.toString(),transactionHash:swapStep.hash},
 finalVirtualBalances:{mockWeth:virtual[0].toString(),mockUsdc:virtual[1].toString()},
 makerAllowancesToAqua:{mockWeth:makerWethAllowance.toString(),mockUsdc:makerUsdcAllowance.toString()},
 transactions:receipts};
mkdirSync('docs/phase-4',{recursive:true});mkdirSync('packages/contracts/deployments',{recursive:true});
writeFileSync('docs/phase-4/live-market.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('packages/contracts/deployments/sepolia.phase4.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({verified:true,market,strategyHash,swap:swapStep.hash,outputMockUsdc:expectedOut.toString()}));
