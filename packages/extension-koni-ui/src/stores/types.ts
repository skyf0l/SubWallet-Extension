// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { CustomEvmToken, NetworkJson, NftItem, TransactionHistoryItemType } from '@subwallet/extension-base/background/KoniTypes';
import { AccountJson } from '@subwallet/extension-base/background/types';

export type CurrentAccountType = {
  account?: AccountJson | null;
}

export type TransactionHistoryReducerType = {
  historyMap: Record<string, TransactionHistoryItemType[]>
}

export type TransferNftParams = {
  nftItem: NftItem;
  collectionImage?: string;
  collectionId: string;
}

export type TokenConfigParams = {
  data: CustomEvmToken
}

export type NetworkConfigParams = {
  mode: 'create' | 'edit' | 'init',
  data: NetworkJson;
}

export type BondingParams = {
  selectedNetwork: string | null;
  selectedValidator: string | null;
}
