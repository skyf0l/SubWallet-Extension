// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { _ChainAsset, _ChainInfo, _MultiChainAsset } from '@subwallet/chain-list/types';
import { AuthUrlInfo } from '@subwallet/extension-base/background/handlers/State';
import { AddNetworkRequestExternal, AssetSetting, BalanceItem, ChainBondingInfo, ConfirmationDefinitions, ConfirmationsQueue, ConfirmationType, CrowdloanItem, KeyringState, LanguageType, NftCollection, NftItem, NominationPoolInfo, NominatorInfo, PriceJson, StakingItem, StakingRewardItem, TransactionHistoryItem, UiSettings, UnlockingStakeInfo, ValidatorInfo } from '@subwallet/extension-base/background/KoniTypes';
import { AccountJson, AccountsContext, AuthorizeRequest, MetadataRequest } from '@subwallet/extension-base/background/types';
import { _ChainState } from '@subwallet/extension-base/services/chain-service/types';
import { SigningRequest } from '@subwallet/extension-base/services/request-service/types';

import { SettingsStruct } from '@polkadot/ui-settings/types';

// todo: move this file to extension-koni-ui/src/types/

export type CurrentAccountType = {
  account?: AccountJson | null;
}

export type TransactionHistoryReducerType = {
  historyList: TransactionHistoryItem[]
}

export type TransferNftParams = {
  nftItem: NftItem;
  collectionImage?: string;
  collectionId: string;
}

export type TokenConfigParams = {
  data: _ChainAsset
}

export type NetworkConfigParams = {
  mode: 'create' | 'edit' | 'init',
  data?: _ChainInfo;
  externalData?: AddNetworkRequestExternal;
}

export type BondingParams = {
  selectedAccount: string | null;
  selectedNetwork: string | null;
  selectedValidator: ValidatorInfo | null;
  maxNominatorPerValidator: number | null;
  isBondedBefore: boolean | null;
  bondedValidators: string[] | null;
}

export type UnbondingParams = {
  selectedAccount: string | null;
  selectedNetwork: string | null;
  bondedAmount: number | null;
}

export type StakeCompoundParams = {
  selectedAccount: string;
  selectedNetwork: string;
}

export type KeyringStateParams = {
  mode: 'create' | 'edit' | 'init',
  data: _ChainInfo;
}

export type StakingRewardJson_ = {
  details: StakingRewardItem[],
  ready: boolean
}

export enum ReduxStatus {
  INIT = 'init',
  CACHED = 'cached',
  READY = 'ready'
}

export interface BaseReduxStore {
  reduxStatus: ReduxStatus
}

// todo: merge with UiSettings later
export interface LocalUiSettings {
  language: LanguageType,
  isShowZeroBalance: boolean,
}

export interface AppSettings extends LocalUiSettings, UiSettings, SettingsStruct, BaseReduxStore {
  authUrls: Record<string, AuthUrlInfo>,
  mediaAllowed: boolean
}

export interface AccountState extends AccountsContext, KeyringState, BaseReduxStore {
  currentAccount: AccountJson | null

  isAllAccount: boolean
}

export interface RequestState extends ConfirmationsQueue, BaseReduxStore {
  authorizeRequest: Record<string, AuthorizeRequest>
  metadataRequest: Record<string, MetadataRequest>
  signingRequest: Record<string, SigningRequest>
  hasConfirmations: boolean
  hasInternalConfirmations: boolean
  numberOfConfirmations: number
}

export interface UpdateConfirmationsQueueRequest extends BaseReduxStore {
  type: ConfirmationType,
  data: Record<string, ConfirmationDefinitions[ConfirmationType][0]>
}

export interface AssetRegistryStore extends BaseReduxStore {
  assetRegistry: Record<string, _ChainAsset>;
  multiChainAssetMap: Record<string, _MultiChainAsset>;
  assetSettingMap: Record<string, AssetSetting>;
}

export interface ChainStore extends BaseReduxStore {
  chainInfoMap: Record<string, _ChainInfo>,
  chainStateMap: Record<string, _ChainState>
}

export interface BalanceStore extends BaseReduxStore {
  balanceMap: Record<string, BalanceItem>
}

export type PriceStore = PriceJson

export interface CrowdloanStore extends BaseReduxStore {
  crowdloanMap: Record<string, CrowdloanItem>
}

export interface NftStore extends BaseReduxStore {
  nftItems: NftItem[],
  nftCollections: NftCollection[]
}

export interface StakingStore extends BaseReduxStore {
  stakingMap: StakingItem[],
  stakingRewardMap: StakingRewardItem[],
  stakeUnlockingMap: UnlockingStakeInfo[]
}

export interface BondingStore extends BaseReduxStore {
  chainBondingInfoMap: Record<string, ChainBondingInfo>,
  validatorInfoMap: Record<string, ValidatorInfo[]>,
  nominationPoolInfoMap: Record<string, NominationPoolInfo[]>,
  nominatorInfo: Record<string, NominatorInfo>
}
