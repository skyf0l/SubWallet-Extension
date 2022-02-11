// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import useGenesisHashOptions from '@polkadot/extension-koni-ui/hooks/useGenesisHashOptions';

function getShowedNetworks (genesisOptions: any[], networkKey: string): string[] {
  if (networkKey === 'all') {
    return genesisOptions.filter((i) => (i.networkKey) && (i.networkKey !== 'all')).map((i) => i.networkKey);
  }

  return [networkKey];
}

export default function useShowedNetworks (currentNetworkKey: string): string[] {
  const genesisOptions = useGenesisHashOptions();

  return getShowedNetworks(genesisOptions, currentNetworkKey);
}