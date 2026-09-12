"""Run ENSv2 integration checks on a disposable local Sepolia fork."""
import json
import os
from pathlib import Path
import socket
import subprocess
import time

root = Path(__file__).resolve().parents[1]
rpc = os.environ.get('SEPOLIA_RPC_URL') or (root / '.secrets/sepolia-rpc-url').read_text().strip()
# Refuse an occupied port so tests cannot mutate another local node.
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 18545))
process = subprocess.Popen(
    ['anvil', '--fork-url', rpc, '--fork-block-number', '11690690', '--host', '127.0.0.1', '--port', '18545', '--chain-id', '11155111', '--silent'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
try:
    for _ in range(100):
        if process.poll() is not None:
            raise RuntimeError('Anvil exited before readiness; check toolchain and Sepolia RPC access')
        with socket.socket() as probe:
            if probe.connect_ex(('127.0.0.1', 18545)) == 0:
                break
        time.sleep(0.1)
    else:
        raise RuntimeError('Local fork did not become ready')
    result = subprocess.run(['pnpm', 'exec', 'tsx', 'scripts/test-identity-fork.ts'], cwd=root, capture_output=True, text=True, timeout=120)
    output = (result.stdout + result.stderr).replace(rpc, '[REDACTED_RPC]')
    print(output, end='')
    evidence = root / 'docs/phase-2/fork-test.txt'
    evidence.parent.mkdir(parents=True, exist_ok=True)
    evidence.write_text(output)
    raise SystemExit(result.returncode)
finally:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
