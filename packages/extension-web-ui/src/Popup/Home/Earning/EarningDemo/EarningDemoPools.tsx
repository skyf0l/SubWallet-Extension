// Copyright 2019-2022 @subwallet/extension-web-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { isLendingPool, isLiquidPool } from '@subwallet/extension-base/services/earning-service/utils';
import { YieldPoolInfo, YieldPoolType } from '@subwallet/extension-base/types';
import { EarningInstructionModal, EarningPoolItem, EmptyList, FilterModal, Layout } from '@subwallet/extension-web-ui/components';
import { DEFAULT_EARN_PARAMS, EARN_TRANSACTION, EARNING_INSTRUCTION_MODAL } from '@subwallet/extension-web-ui/constants';
import { ScreenContext } from '@subwallet/extension-web-ui/contexts/ScreenContext';
import { useFilterModal, useHandleChainConnection, usePreviewYieldPoolInfoByGroup, useSelector, useTranslation } from '@subwallet/extension-web-ui/hooks';
import { ChainConnectionWrapper } from '@subwallet/extension-web-ui/Popup/Home/Earning/shared/ChainConnectionWrapper';
import { EarningPoolsTable } from '@subwallet/extension-web-ui/Popup/Home/Earning/shared/desktop/EarningPoolsTable';
import { Toolbar } from '@subwallet/extension-web-ui/Popup/Home/Earning/shared/desktop/Toolbar';
import { EarningPoolsParam, ThemeProps } from '@subwallet/extension-web-ui/types';
import { isAccountAll } from '@subwallet/extension-web-ui/utils';
import { Icon, ModalContext, SwList } from '@subwallet/react-ui';
import BigN from 'bignumber.js';
import { FadersHorizontal, Vault } from 'phosphor-react';
import React, { SyntheticEvent, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import styled from 'styled-components';
import { useLocalStorage } from 'usehooks-ts';

type Props = ThemeProps;
type ComponentProps = {
  poolGroup: string,
  symbol: string,
};

const connectChainModalId = 'earning-pools-connect-chain-modal';
const chainConnectionLoadingModalId = 'earning-pools-chain-connection-loading-modalId';
const alertModalId = 'earning-pools-alert-modal';
const instructionModalId = EARNING_INSTRUCTION_MODAL;

const FILTER_MODAL_ID = 'earning-pool-filter-modal';

function Component ({ poolGroup, symbol }: ComponentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isWebUI } = useContext(ScreenContext);

  const { poolInfoMap = {} }: {
    poolInfoMap: Record<string, YieldPoolInfo>,
  } = useOutletContext();

  const pools = usePreviewYieldPoolInfoByGroup(poolGroup, poolInfoMap);

  const chainInfoMap = useSelector((state) => state.chainStore.chainInfoMap);
  const assetRegistry = useSelector((state) => state.assetRegistry.assetRegistry);
  const currentAccount = useSelector((state) => state.accountState.currentAccount);

  const [, setEarnStorage] = useLocalStorage(EARN_TRANSACTION, DEFAULT_EARN_PARAMS);

  const [selectedPool, setSelectedPool] = React.useState<YieldPoolInfo | undefined>(undefined);
  const [searchInput, setSearchInput] = useState<string>('');

  const { activeModal } = useContext(ModalContext);

  const { filterSelectionMap, onApplyFilter, onChangeFilterOption, onCloseFilterModal, selectedFilters } = useFilterModal(FILTER_MODAL_ID);

  const filterOptions = [
    { label: t('Nomination pool'), value: YieldPoolType.NOMINATION_POOL },
    { label: t('Direct nomination'), value: YieldPoolType.NATIVE_STAKING },
    { label: t('Liquid staking'), value: YieldPoolType.LIQUID_STAKING },
    { label: t('Lending'), value: YieldPoolType.LENDING },
    { label: t('Parachain staking'), value: YieldPoolType.PARACHAIN_STAKING },
    { label: t('Single farming'), value: YieldPoolType.SINGLE_FARMING }
  ];
  const items: YieldPoolInfo[] = useMemo(() => {
    if (!pools.length) {
      return [];
    }

    const result = [...pools];

    result.sort((a, b) => {
      const getType = (pool: YieldPoolInfo) => {
        if (pool.type === YieldPoolType.NOMINATION_POOL) {
          return 1;
        } else {
          return -1;
        }
      };

      const getTotal = (pool: YieldPoolInfo) => {
        const tvl = pool.statistic?.tvl;

        return tvl ? new BigN(tvl).toNumber() : -1;
      };

      return getTotal(b) - getTotal(a) || getType(b) - getType(a);
    });

    return result;
  }, [pools]);

  const filterFunction = useMemo<(item: YieldPoolInfo) => boolean>(() => {
    return (item) => {
      if (!selectedFilters.length) {
        return true;
      }

      for (const filter of selectedFilters) {
        if (filter === '') {
          return true;
        }

        if (filter === YieldPoolType.NOMINATION_POOL && item.type === YieldPoolType.NOMINATION_POOL) {
          return true;
        } else if (filter === YieldPoolType.NATIVE_STAKING && item.type === YieldPoolType.NATIVE_STAKING) {
          return true;
        } else if (filter === YieldPoolType.LIQUID_STAKING && item.type === YieldPoolType.LIQUID_STAKING) {
          return true;
        } else if (filter === YieldPoolType.LENDING && item.type === YieldPoolType.LENDING) {
          return true;
        }
        // Uncomment the following code block if needed
        // else if (filter === YieldPoolType.PARACHAIN_STAKING && item.type === YieldPoolType.PARACHAIN_STAKING) {
        //   return true;
        // } else if (filter === YieldPoolType.SINGLE_FARMING && item.type === YieldPoolType.SINGLE_FARMING) {
        //   return true;
        // }
      }

      return false;
    };
  }, [selectedFilters]);

  const navigateToEarnTransaction = useCallback(
    (slug: string, chain: string) => {
      setEarnStorage({
        ...DEFAULT_EARN_PARAMS,
        slug,
        chain,
        from: currentAccount?.address ? isAccountAll(currentAccount.address) ? '' : currentAccount.address : ''
      });
      navigate('/transaction/earn');
    },
    [currentAccount?.address, navigate, setEarnStorage]
  );

  const onConnectChainSuccess = useCallback(() => {
    activeModal(instructionModalId);
  }, [activeModal]);

  const { alertProps,
    checkChainConnected,
    closeAlert,
    closeConnectChainModal,
    connectingChain,
    onConnectChain,
    openAlert,
    openConnectChainModal, setExtraSuccessFlag, turnOnChain } = useHandleChainConnection({
    alertModalId,
    chainConnectionLoadingModalId,
    connectChainModalId
  }, onConnectChainSuccess);

  const [currentAltChain, setCurrentAltChain] = useState<string | undefined>();

  const getAltChain = useCallback((poolInfo: YieldPoolInfo) => {
    if (isLiquidPool(poolInfo) || isLendingPool(poolInfo)) {
      const asset = assetRegistry[poolInfo.metadata.altInputAssets || ''];

      return asset ? asset.originChain : '';
    }

    return '';
  }, [assetRegistry]);

  const onClickItem = useCallback((item: YieldPoolInfo) => {
    return () => {
      setSelectedPool(item);

      const altChain = getAltChain(item);

      if (!checkChainConnected(item.chain)) {
        if (altChain) {
          setCurrentAltChain(altChain);
        }

        openConnectChainModal(item.chain);

        return;
      }

      activeModal(instructionModalId);
    };
  }, [activeModal, checkChainConnected, getAltChain, openConnectChainModal]);

  const _onConnectChain = useCallback((chain: string) => {
    if (currentAltChain) {
      turnOnChain(currentAltChain);
    }

    onConnectChain(chain);
  }, [currentAltChain, onConnectChain, turnOnChain]);

  useEffect(() => {
    if (currentAltChain) {
      setExtraSuccessFlag(checkChainConnected(currentAltChain));
    } else {
      setExtraSuccessFlag(true);
    }
  }, [checkChainConnected, currentAltChain, setExtraSuccessFlag]);

  const onClickRow = useCallback((item: YieldPoolInfo) => {
    onClickItem(item)();
  }, [onClickItem]);

  const renderItem = useCallback(
    (item: YieldPoolInfo) => {
      return (
        <EarningPoolItem
          className={'earning-pool-item'}
          key={item.slug}
          onClick={onClickItem(item)}
          poolInfo={item}
        />
      );
    },
    [onClickItem]
  );

  const emptyList = useCallback(() => {
    return (
      <EmptyList
        className='__empty-list-earning-pool'
        emptyMessage={t('Change your search and try again')}
        emptyTitle={t('No earning option found')}
        phosphorIcon={Vault}
      />
    );
  }, [t]);

  const searchFunction = useCallback(
    ({ chain, metadata: { shortName } }: YieldPoolInfo, searchText: string) => {
      const chainInfo = chainInfoMap[chain];

      return (
        chainInfo?.name.replace(' Relay Chain', '').toLowerCase().includes(searchText.toLowerCase()) ||
        shortName.toLowerCase().includes(searchText.toLowerCase())
      );
    },
    [chainInfoMap]
  );

  const onClickFilterButton = useCallback(
    (e?: SyntheticEvent) => {
      e && e.stopPropagation();
      activeModal(FILTER_MODAL_ID);
    },
    [activeModal]
  );

  const onBack = useCallback(() => {
    navigate('/earning-demo');
  }, [navigate]);

  return (
    <ChainConnectionWrapper
      alertModalId={alertModalId}
      alertProps={alertProps}
      chainConnectionLoadingModalId={chainConnectionLoadingModalId}
      closeConnectChainModal={closeConnectChainModal}
      connectChainModalId={connectChainModalId}
      connectingChain={connectingChain}
      onConnectChain={_onConnectChain}
    >
      <Layout.Base
        className={'__screen-container'}
        onBack={onBack}
        showBackButton={true}
        showSubHeader={true}
        subHeaderBackground={'transparent'}
        subHeaderCenter={false}
        subHeaderPaddingVertical={true}
        title={t<string>('{{symbol}} earning options', { replace: { symbol: symbol } })}
      >
        <div className={'__body-area'}>
          {
            isWebUI
              ? (
                <>
                  <Toolbar
                    className={'__desktop-toolbar'}
                    inputPlaceholder={t<string>('Search token')}
                    onClickFilter={onClickFilterButton}
                    onSearch={setSearchInput}
                    searchValue={searchInput}
                  />

                  <EarningPoolsTable
                    emptyListFunction={emptyList}
                    filterFunction={filterFunction}
                    items={items}
                    onClickRow={onClickRow}
                    searchFunction={searchFunction}
                    searchTerm={searchInput}
                  />
                </>
              )
              : (
                <SwList.Section
                  actionBtnIcon={<Icon phosphorIcon={FadersHorizontal} />}
                  className={'__section-list-container'}
                  enableSearchInput
                  filterBy={filterFunction}
                  list={items}
                  onClickActionBtn={onClickFilterButton}
                  renderItem={renderItem}
                  renderWhenEmpty={emptyList}
                  searchFunction={searchFunction}
                  searchMinCharactersCount={1}
                  searchPlaceholder={t<string>('Search token')}
                  showActionBtn
                />
              )
          }
        </div>

        <FilterModal
          applyFilterButtonTitle={t('Apply filter')}
          id={FILTER_MODAL_ID}
          onApplyFilter={onApplyFilter}
          onCancel={onCloseFilterModal}
          onChangeOption={onChangeFilterOption}
          optionSelectionMap={filterSelectionMap}
          options={filterOptions}
          title={t('Filter')}
        />
      </Layout.Base>

      {
        selectedPool && (
          <EarningInstructionModal
            address={currentAccount?.address}
            assetRegistry={assetRegistry}
            closeAlert={closeAlert}
            isShowStakeMoreButton={true}
            onStakeMore={navigateToEarnTransaction}
            openAlert={openAlert}
            poolInfo={selectedPool}
          />
        )
      }
    </ChainConnectionWrapper>
  );
}

const ComponentGate = ({ className }: Props) => {
  const navigate = useNavigate();
  const locationState = useLocation().state as EarningPoolsParam;

  useEffect(() => {
    if (!locationState?.poolGroup || !locationState?.symbol) {
      navigate('/earning-demo');
    }
  }, [locationState?.poolGroup, locationState?.symbol, navigate]);

  if (!locationState?.poolGroup || !locationState?.symbol) {
    return <></>;
  }

  return (
    <div className={className}>
      <Component
        poolGroup={locationState.poolGroup}
        symbol={locationState.symbol}
      />
    </div>
  );
};

const EarningDemoPools = styled(ComponentGate)<Props>(({ theme: { token } }: Props) => ({
  height: '100%',

  '.__body-area': {
    overflow: 'auto',
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingLeft: 166,
    paddingRight: 166,
    display: 'flex',
    flexDirection: 'column'
  },

  '@media (max-width: 1200px)': {
    '.__body-area': {
      paddingLeft: 44,
      paddingRight: 44
    }
  },

  '@media (max-width: 991px)': {
    '.__body-area': {
      paddingLeft: 0,
      paddingRight: 0,
      height: '100%'
    }
  },

  '.ant-sw-list': {
    paddingBottom: token.padding
  },

  '.ant-sw-sub-header-container': {
    marginBottom: token.marginXS
  },

  '.earning-pools-table-container': {
    height: '100%',
    overflow: 'auto'
  },

  '.earning-pools-table': {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto'
  },

  '.__tbody': {
    flex: 1,
    overflow: 'auto',
    paddingBottom: token.size
  },

  '.__empty-list-earning-pool': {
    height: '100%'
  },

  '.__section-list-container': {
    height: '100%',
    flex: 1
  },

  '.earning-pool-item': {
    '+ .earning-pool-item': {
      marginTop: token.marginXS
    }
  },

  '.__desktop-toolbar': {
    marginBottom: 33
  },

  '@media (min-width: 992px)': {
    '.__empty-list-earning-pool': {
      paddingBottom: 62,
      paddingTop: 32
    }
  }
}));

export default EarningDemoPools;