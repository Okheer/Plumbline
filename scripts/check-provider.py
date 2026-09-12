#!/usr/bin/env python3
"""Replay three historical Sepolia blocks and cross-check their hashes via RPC."""
from pathlib import Path
import os,json,subprocess,urllib.request
r=Path(__file__).resolve().parents[1]
token=(r/'.secrets/substreams-token').read_text().strip()
url=(r/'.secrets/sepolia-rpc-url').read_text().strip()
def rpc(method,params):
    req=urllib.request.Request(url,data=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode(),headers={'Content-Type':'application/json'})
    try:
        d=json.load(urllib.request.urlopen(req,timeout=20))
        if 'error' in d: raise ValueError('RPC returned an error')
        return d['result']
    except Exception: raise SystemExit('RPC check failed; credential URL omitted.') from None
assert int(rpc('eth_chainId',[]),16)==11155111,'Wrong chain'
start=11690532
end=start+2
env=os.environ.copy();env['SUBSTREAMS_API_TOKEN']=token
command=[str(r/'.tools/bin/substreams'),'run','ethereum-common@v0.3.3','all_events','-e','sepolia.eth.streamingfast.io:443','--network','sepolia','-s',str(start),'-t','+3','--max-retries','0','-o','jsonl']
try:
    p=subprocess.run(command,capture_output=True,text=True,env=env,timeout=90)
except subprocess.TimeoutExpired: raise SystemExit('Substreams timed out; gate not passed.') from None
if p.returncode:
    print(p.stderr.replace(token,'[REDACTED]').replace(url,'[REDACTED]')[:2000]);raise SystemExit(p.returncode)
blocks=[]
for line in p.stdout.splitlines():
    try: item=json.loads(line)
    except json.JSONDecodeError: continue
    if '@block' not in item: continue
    n=item['@block'];block=rpc('eth_getBlockByNumber',[hex(n),False])
    assert block['hash'][2:]==item['@data']['clock']['id'],'Provider/RPC hash mismatch'
    blocks.append({'number':n,'hash':block['hash']})
assert [b['number'] for b in blocks]==list(range(start,end+1)),'Missing or duplicate blocks'
report={'passed':True,'chainId':11155111,'package':'ethereum-common@v0.3.3','module':'all_events','endpoint':'sepolia.eth.streamingfast.io:443','finalBlocksOnly':False,'command':command,'blocks':blocks}
(r/'docs/phase-1/provider-gate.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
