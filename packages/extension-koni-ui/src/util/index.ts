// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { NetWorkInfo } from '@polkadot/extension-base/background/KoniTypes';
import { AccountJson, AccountWithChildren } from '@polkadot/extension-base/background/types';
import LogosMap from '@polkadot/extension-koni-ui/assets/logo';
import { Recoded } from '@polkadot/extension-koni-ui/types';
import reformatAddress from '@polkadot/extension-koni-ui/util/reformatAddress';
import { decodeAddress } from '@polkadot/util-crypto';
import { KeypairType } from '@polkadot/util-crypto/types';

export * from './common';
export * from './chainBalancesApi';

// todo: Refactor this file

function findSubstrateAccount (accounts: AccountJson[], publicKey: Uint8Array): AccountJson | null {
  const pkStr = publicKey.toString();

  return accounts.find(({ address }): boolean =>
    decodeAddress(address).toString() === pkStr
  ) || null;
}

export function findAccountByAddress (accounts: AccountJson[], _address: string): AccountJson | null {
  return accounts.find(({ address }): boolean =>
    address === _address
  ) || null;
}

export function recodeAddress (address: string, accounts: AccountWithChildren[], networkInfo: NetWorkInfo | null, type?: KeypairType): Recoded {
  const publicKey = decodeAddress(address);
  const account = findAccountByAddress(accounts, address) || findSubstrateAccount(accounts, publicKey);
  const prefix = networkInfo ? networkInfo.ss58Format : 42;
  const isEthereum = type === 'ethereum' || !!(networkInfo?.isEthereum);

  return {
    account,
    formatted: reformatAddress(address, prefix, isEthereum),
    genesisHash: account?.genesisHash,
    prefix,
    isEthereum
  };
}

export const defaultRecoded: Recoded = { account: null, formatted: null, prefix: 42, isEthereum: false };

export function getLogoByNetworkKey (networkKey: string): string {
  return LogosMap[networkKey] || LogosMap.default;
}

export const subscanByNetworkKey: Record<string, string> = {
  acala: 'https://acala.subscan.io',
  // 'altair': 'https://altair.subscan.io',
  astar: 'https://astar.subscan.io',
  // 'basilisk': 'https://basilisk.subscan.io',
  bifrost: 'https://bifrost.subscan.io',
  calamari: 'https://calamari.subscan.io',
  centrifuge: 'https://centrifuge.subscan.io/',
  clover: 'https://clover.subscan.io',
  // 'coinversation': 'https://coinversation.subscan.io',
  // 'composableFinance': 'https://composableFinance.subscan.io',
  crust: 'https://crust.subscan.io',
  darwinia: 'https://darwinia.subscan.io',
  edgeware: 'https://edgeware.subscan.io/',
  // 'efinity': 'https://efinity.subscan.io/',
  equilibrium: 'https://equilibrium.subscan.io/',
  // 'genshiro': 'https://genshiro.subscan.io',
  heiko: 'https://parallel-heiko.subscan.io',
  hydradx: 'https://hydradx.subscan.io',
  // 'interlay': 'https://interlay.subscan.io',
  karura: 'https://karura.subscan.io',
  khala: 'https://khala.subscan.io',
  kilt: 'https://spiritnet.subscan.io',
  // 'kintsugi': 'https://kintsugi.subscan.io',
  kusama: 'https://kusama.subscan.io',
  // 'litentry': 'https://litentry.subscan.io',
  // 'manta': 'https://manta.subscan.io',
  moonbeam: 'https://moonbeam.subscan.io',
  moonriver: 'https://moonriver.subscan.io',
  // 'nodle': 'https://nodle.subscan.io',
  parallel: 'https://parallel.subscan.io',
  // 'phala': 'https://phala.subscan.io',
  // 'picasso': 'https://picasso.subscan.io',
  pichiu: 'https://pichiu.subscan.io',
  // 'pioneer': 'https://pioneer.subscan.io',
  polkadot: 'https://polkadot.subscan.io',
  quartz: 'https://quartz.subscan.io',
  sakura: 'https://sakura.subscan.io',
  // 'shadow': 'https://shadow.subscan.io',
  shiden: 'https://shiden.subscan.io',
  sora: 'https://sora.subscan.io',
  statemine: 'https://statemine.subscan.io',
  subgame: 'https://subgame.subscan.io',
  // 'statemint': 'https://statemint.subscan.io',
  // 'subsocial': 'https://subsocial.subscan.io',
  // 'zeitgeist': 'https://zeitgeist.subscan.io',
  westend: 'https://westend.subscan.io',
  // 'rococo': 'https://rococo.subscan.io',
  robonomics: 'https://robonomics.subscan.io'

};

export const moonbeamScanUrl = 'https://moonbeam.moonscan.io';

export const moonriverScanUrl = 'https://moonriver.moonscan.io';

export function isSupportSubscan (networkKey: string): boolean {
  return !!subscanByNetworkKey[networkKey];
}

export function isSupportScanExplorer (networkKey: string): boolean {
  return ['moonbeam', 'moonriver'].includes(networkKey) || isSupportSubscan(networkKey);
}

export function getScanExplorerTransactionHistoryUrl (networkKey: string, hash: string): string {
  if (networkKey === 'moonbeam') {
    return `${moonbeamScanUrl}/tx/${hash}`;
  }

  if (networkKey === 'moonriver') {
    return `${moonriverScanUrl}/tx/${hash}`;
  }

  return `${subscanByNetworkKey[networkKey]}/extrinsic/${hash}`;
}

export function getScanExplorerAddressInfoUrl (networkKey: string, address: string): string {
  if (networkKey === 'moonbeam') {
    return `${moonbeamScanUrl}/address/${address}`;
  }

  if (networkKey === 'moonriver') {
    return `${moonriverScanUrl}/address/${address}`;
  }

  return `${subscanByNetworkKey[networkKey]}/account/${address}`;
}

export { toAddress } from './toAddress';