import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { CHAIN_ID, intentSchema } from '@plumbline/shared';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const publicWallet='0x89cE79730f8a1F4B05B4EF9334ef4f53E237dE20' as const;
function rpcClient(){const url=process.env.SEPOLIA_RPC_URL || readFileSync(root+'.secrets/sepolia-rpc-url','utf8').trim();return createPublicClient({chain:sepolia,transport:http(url,{retryCount:0,timeout:10000})});}
createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 const send=(code:number,value:unknown)=>{res.statusCode=code;res.end(JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v));};
 if(req.method==='GET'&&req.url==='/health')return send(200,{service:'plumbline-backend',phase:1,chainId:CHAIN_ID,tradingEnabled:false});
 if(req.method==='GET'&&req.url==='/network'){
  try{const client=rpcClient();const chainId=await client.getChainId();if(chainId!==CHAIN_ID)return send(503,{error:'Configured RPC is not Sepolia'});const blockNumber=await client.getBlockNumber();const balance=await client.getBalance({address:publicWallet,blockNumber});return send(200,{chainId,blockNumber,wallet:publicWallet,balanceWei:balance});}catch{return send(503,{error:'Sepolia RPC unavailable; check private configuration'});}
 }
 if(req.method==='POST'&&req.url==='/intents/validate'){
  let body='';try{for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>16384)return send(413,{error:'Request too large'});}const result=intentSchema.safeParse(JSON.parse(body));return result.success?send(200,{valid:true,intent:result.data,executed:false}):send(400,{valid:false,errors:result.error.issues});}catch{return send(400,{error:'Invalid JSON'});}
 }
 send(404,{error:'Not found'});
}).listen(Number(process.env.PORT || 3001),'127.0.0.1',()=>console.log('Plumbline backend: http://127.0.0.1:3001'));
