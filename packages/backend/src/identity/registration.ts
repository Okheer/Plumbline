import { encodeFunctionData, getAddress, zeroHash, type Address, type Hex } from 'viem';
import { deployment, label, type Transaction } from './transactions.js';
export interface Registration {
 label: string; owner: Address; secret: Hex; subregistry: Address;
 resolver: Address; duration: bigint;
}
export function commitmentArgs(r: Registration) {
 if (!/^0x[0-9a-fA-F]{64}$/.test(r.secret)) throw new Error('Expected a 32-byte registration secret');
 if (r.duration <= 0n || r.duration >= 1n << 64n) throw new Error('Invalid registration duration');
 return [label(r.label), getAddress(r.owner), r.secret, getAddress(r.subregistry), getAddress(r.resolver), r.duration, zeroHash] as const;
}
export function commitRegistration(commitment: Hex): Transaction {
 const registrar = deployment('ETHRegistrar');
 return {to: registrar.address, data: encodeFunctionData({abi: registrar.abi, functionName: 'commit', args: [commitment]}), value: '0', description: 'Commit ENS root registration'};
}
export function revealRegistration(r: Registration, paymentToken: Address): Transaction {
 const registrar = deployment('ETHRegistrar');
 const [name, owner, secret, subregistry, resolver, duration, referrer] = commitmentArgs(r);
 return {to: registrar.address, data: encodeFunctionData({abi: registrar.abi, functionName: 'register', args: [name, owner, secret, subregistry, resolver, duration, getAddress(paymentToken), referrer]}), value: '0', description: 'Register ENS root using approved test tokens'};
}
