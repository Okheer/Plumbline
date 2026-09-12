import * as aqua from '@1inch/aqua-sdk';
import * as swapVM from '@1inch/swap-vm-sdk';
import * as ens from '@ensdomains/ensjs';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
for(const [name,sdk] of Object.entries({aqua,swapVM,ens})) {if(!Object.keys(sdk).length)throw new Error(`${name} has no exports`);console.log(`${name}: import OK`);}
if(createPublicClient({chain:sepolia,transport:http()}).chain.id!==11155111)throw new Error('Wrong chain');
console.log('viem Sepolia configuration OK; no deployment compatibility is implied');
