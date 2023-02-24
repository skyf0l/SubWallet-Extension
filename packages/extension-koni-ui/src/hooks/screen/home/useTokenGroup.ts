// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { _getAssetSymbol, _getMultiChainAsset } from '@subwallet/extension-base/services/chain-service/utils';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { AssetRegistryStore } from '@subwallet/extension-koni-ui/stores/types';
import { TokenGroupHookType } from '@subwallet/extension-koni-ui/types/hook';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';

function sortTokenSlugs (tokenSlugs: string[]) {
  tokenSlugs.sort((a, b) => {
    const hasNativeA = a.includes('NATIVE');
    const hasNativeB = b.includes('NATIVE');

    if (hasNativeA && !hasNativeB) {
      return -1; // if only element a has "NATIVE", a comes before b
    } else if (!hasNativeA && hasNativeB) {
      return 1; // if only element b has "NATIVE", a comes after b
    } else {
      return a.localeCompare(b); // if both elements have "native" or neither does, sort alphabetically
    }
  });
}

function sortTokenGroupMap (tokenGroupMap: TokenGroupHookType['tokenGroupMap']) {
  Object.keys(tokenGroupMap).forEach((tokenGroup) => {
    sortTokenSlugs(tokenGroupMap[tokenGroup]);
  });
}

const prioritizedTokenGroups = ['DOT-Polkadot', 'KSM-Kusama'];

function sortTokenGroups (tokenGroups: string[]) {
  tokenGroups.sort((a, b) => {
    const indexA = prioritizedTokenGroups.indexOf(a);
    const indexB = prioritizedTokenGroups.indexOf(b);

    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b); // if both elements are not in the prioritizedTokenGroups array, sort alphabetically
    } else if (indexA === -1) {
      return 1; // if only element b is in the prioritizedTokenGroups array, a comes after b
    } else if (indexB === -1) {
      return -1; // if only element a is in the prioritizedTokenGroups array, a comes before b
    } else {
      return indexA - indexB; // if both elements are in the prioritizedTokenGroups array, sort by their position in the array
    }
  });
}

function getTokenGroup (assetRegistryMap: AssetRegistryStore['assetRegistry'], filteredChains?: string[]): TokenGroupHookType {
  const result: TokenGroupHookType = {
    tokenGroupMap: {},
    sortedTokenGroups: [],
    sortedTokenSlugs: []
  };

  Object.keys(assetRegistryMap).forEach((slug) => {
    const chain = (slug.split('-'))[0];

    if (filteredChains && !filteredChains.includes(chain)) {
      return;
    }

    const token = _getAssetSymbol(assetRegistryMap[slug]);

    const multiChainAsset = _getMultiChainAsset(assetRegistryMap[slug]);
    const tokenGroupKey = multiChainAsset || `${token}-${chain}`;

    if (result.tokenGroupMap[tokenGroupKey]) {
      result.tokenGroupMap[tokenGroupKey].push(slug);
    } else {
      result.tokenGroupMap[tokenGroupKey] = [slug];
      result.sortedTokenGroups.push(tokenGroupKey);
    }
  });

  sortTokenGroupMap(result.tokenGroupMap);
  sortTokenGroups(result.sortedTokenGroups);

  result.sortedTokenGroups.forEach((tokenGroup) => {
    result.sortedTokenSlugs.push(...result.tokenGroupMap[tokenGroup]);
  });

  return result;
}

export default function useTokenGroup (filteredChains?: string[]): TokenGroupHookType {
  const assetRegistryMap = useSelector((state: RootState) => state.assetRegistry.assetRegistry);

  return useMemo<TokenGroupHookType>(() => {
    return getTokenGroup(assetRegistryMap, filteredChains);
  }, [assetRegistryMap, filteredChains]);
}