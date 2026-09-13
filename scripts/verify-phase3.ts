import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  createPublicClient,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
} from 'viem';
import { labelhash, namehash } from 'viem/ens';
import { sepolia } from 'viem/chains';
import { AGENT_ACTIVE, mandateKeys } from '../packages/backend/src/authority/transactions.ts';
import { deployment } from '../packages/backend/src/identity/transactions.ts';

const root = new URL('../', import.meta.url);
const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const live = readJson('packages/contracts/deployments/sepolia.phase3.json');
const rpc = readFileSync(new URL('.secrets/sepolia-rpc-url', root), 'utf8').trim();
const client = createPublicClient({
  chain: sepolia,
  transport: http(rpc, { retryCount: 0, timeout: 20_000 }),
});

try {
  assert.equal(await client.getChainId(), sepolia.id);
  assert.equal(live.chainId, sepolia.id);

  const registry = deployment('UserRegistryImpl');
  const resolver = deployment('PermissionedResolverImpl');
  const adapterArtifact = readJson(
    'packages/contracts/out/ENSAuthorityAdapter.sol/ENSAuthorityAdapter.json',
  );
  const node = namehash(live.agentName);
  const resourceState = (await client.readContract({
    address: live.strategyRegistry,
    abi: registry.abi,
    functionName: 'getState',
    args: [BigInt(labelhash('agent-01'))],
  })) as { expiry: bigint; latestOwner: Address; resource: bigint };

  assert.equal(resourceState.latestOwner.toLowerCase(), live.agent.toLowerCase());
  assert.equal(resourceState.expiry.toString(), live.agentExpiry);
  assert.equal(
    String(
      await client.readContract({
        address: live.strategyRegistry,
        abi: registry.abi,
        functionName: 'getResolver',
        args: ['agent-01'],
      }),
    ).toLowerCase(),
    live.agentResolver.toLowerCase(),
  );

  const expectedRecords: Record<string, string> = {
    [mandateKeys[0]]: '2',
    [mandateKeys[1]]: '50',
    [mandateKeys[2]]: '200000000000000000000',
    [mandateKeys[3]]: JSON.stringify([live.mockUsdc]),
    [mandateKeys[4]]: '300',
  };
  const records: Record<string, string> = {};
  for (const key of mandateKeys) {
    records[key] = String(
      await client.readContract({
        address: live.agentResolver,
        abi: resolver.abi,
        functionName: 'text',
        args: [node, key],
      }),
    );
    assert.equal(records[key].toLowerCase(), expectedRecords[key].toLowerCase());
  }

  const finalAuthorized = await client.readContract({
    address: live.authorityAdapter,
    abi: adapterArtifact.abi,
    functionName: 'isAuthorized',
    args: [node, live.agent],
  });
  assert.equal(finalAuthorized, false);
  assert.equal(
    await client.readContract({
      address: live.strategyRegistry,
      abi: registry.abi,
      functionName: 'hasRoles',
      args: [resourceState.resource, AGENT_ACTIVE, live.agent],
    }),
    false,
  );

  const allocatorWrite = encodeFunctionData({
    abi: resolver.abi,
    functionName: 'setText',
    args: [node, mandateKeys[0], records[mandateKeys[0]]],
  });
  await client.call({
    account: live.allocator,
    to: live.agentResolver,
    data: allocatorWrite,
  });
  for (const deniedAccount of [
    live.agent,
    '0x0000000000000000000000000000000000000001',
  ] as Address[]) {
    await assert.rejects(
      client.call({ account: deniedAccount, to: live.agentResolver, data: allocatorWrite }),
    );
  }

  const receiptChecks = [];
  for (let index = 0; index < live.lifecycle.length; index++) {
    const step = live.lifecycle[index] as {
      hash: Hex;
      description: string;
      block: string;
      active: boolean;
      version: string;
      maxNotionalQuoteE18: string;
    };
    assert(step.hash);
    const receipt = await client.getTransactionReceipt({ hash: step.hash });
    assert.equal(receipt.status, 'success');
    assert.equal(BigInt(step.block), receipt.blockNumber);
    const historicalAuthorized = await client.readContract({
      address: live.authorityAdapter,
      abi: adapterArtifact.abi,
      functionName: 'isAuthorized',
      args: [node, live.agent],
      blockNumber: receipt.blockNumber,
    });
    assert.equal(historicalAuthorized, step.active);
    const historicalVersion = String(
      await client.readContract({
        address: live.agentResolver,
        abi: resolver.abi,
        functionName: 'text',
        args: [node, mandateKeys[0]],
        blockNumber: receipt.blockNumber,
      }),
    );
    const historicalCap = String(
      await client.readContract({
        address: live.agentResolver,
        abi: resolver.abi,
        functionName: 'text',
        args: [node, mandateKeys[2]],
        blockNumber: receipt.blockNumber,
      }),
    );
    assert.equal(historicalVersion, step.version);
    assert.equal(historicalCap, step.maxNotionalQuoteE18);
    receiptChecks.push({
      description: step.description,
      hash: step.hash,
      block: receipt.blockNumber.toString(),
      active: historicalAuthorized,
      mandateVersion: historicalVersion,
      maxNotionalQuoteE18: historicalCap,
    });
  }

  const report = {
    result: 'PASS',
    chainId: sepolia.id,
    verifiedAt: new Date().toISOString(),
    block: (await client.getBlockNumber()).toString(),
    name: live.agentName,
    strategyRegistry: live.strategyRegistry,
    resolver: live.agentResolver,
    adapter: live.authorityAdapter,
    finalAuthorized,
    allocatorMandateWriteSimulation: true,
    agentMandateWriteRejected: true,
    outsiderMandateWriteRejected: true,
    records,
    lifecycle: receiptChecks,
  };
  mkdirSync(new URL('docs/phase-3/', root), { recursive: true });
  writeFileSync(
    new URL('docs/phase-3/final-verification.json', root),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        result: report.result,
        block: report.block,
        lifecycle: receiptChecks.map((step) => step.active),
        finalAuthorized,
        mandateVersion: records[mandateKeys[0]],
        allocatorOnly: true,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    'Phase 3 verification failed:',
    error instanceof Error ? error.name : 'Unknown error',
    '(provider details omitted)',
  );
  process.exitCode = 1;
}
