// Copyright 2019-2022 @subwallet/extension-base authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { EvmProviderError } from '@subwallet/extension-base/background/errors/EvmProviderError';
import { TransactionError } from '@subwallet/extension-base/background/errors/TransactionError';
import { AmountData, BasicTxErrorType, BasicTxWarningCode, ChainType, EvmProviderErrorType, EvmSendTransactionRequest, ExtrinsicStatus, ExtrinsicType } from '@subwallet/extension-base/background/KoniTypes';
import { TransactionWarning } from '@subwallet/extension-base/background/warnings/TransactionWarning';
import { BalanceService } from '@subwallet/extension-base/services/balance-service';
import { ChainService } from '@subwallet/extension-base/services/chain-service';
import { _getChainNativeTokenBasicInfo, _getEvmChainId } from '@subwallet/extension-base/services/chain-service/utils';
import NotificationService from '@subwallet/extension-base/services/notification-service/NotificationService';
import RequestService from '@subwallet/extension-base/services/request-service';
import { EXTENSION_REQUEST_URL } from '@subwallet/extension-base/services/request-service/constants';
import { getTransactionId, isSubstrateTransaction } from '@subwallet/extension-base/services/transaction-service/helpers';
import { SWTransaction, SWTransactionInput, SWTransactionResponse, TransactionEmitter, TransactionEventMap, TransactionEventResponse, ValidateTransactionResponseInput } from '@subwallet/extension-base/services/transaction-service/types';
import { Web3Transaction } from '@subwallet/extension-base/signers/types';
import { anyNumberToBN } from '@subwallet/extension-base/utils/eth';
import { parseTxAndSignature } from '@subwallet/extension-base/utils/eth/mergeTransactionAndSignature';
import keyring from '@subwallet/ui-keyring';
import EventEmitter from 'eventemitter3';
import RLP, { Input } from 'rlp';
import { BehaviorSubject } from 'rxjs';
import { TransactionConfig } from 'web3-core';

import { SubmittableExtrinsic } from '@polkadot/api/promise/types';
import { Signer, SignerResult } from '@polkadot/api/types';
import { SignerPayloadJSON } from '@polkadot/types/types/extrinsic';
import { u8aToHex } from '@polkadot/util';
import { HexString } from '@polkadot/util/types';

export default class TransactionService {
  private readonly chainService: ChainService;
  private readonly requestService: RequestService;

  readonly #balanceService: BalanceService;
  private readonly transactionSubject: BehaviorSubject<Record<string, SWTransaction>> = new BehaviorSubject<Record<string, SWTransaction>>({});

  private get transactions (): Record<string, SWTransaction> {
    return this.transactionSubject.getValue();
  }

  constructor (chainService: ChainService, requestService: RequestService, balanceService: BalanceService) {
    this.chainService = chainService;
    this.requestService = requestService;
    this.#balanceService = balanceService;
  }

  private get allTransactions (): SWTransaction[] {
    return Object.values(this.transactions);
  }

  private get processingTransactions (): SWTransaction[] {
    return this.allTransactions.filter((t) => t.status === ExtrinsicStatus.PENDING || t.status === ExtrinsicStatus.PROCESSING);
  }

  public getTransaction (id: string) {
    return this.transactions[id];
  }

  private checkDuplicate (transaction: ValidateTransactionResponseInput): TransactionError[] {
    // Check duplicated transaction
    const existed = this.processingTransactions
      .filter((item) => item.address === transaction.address && item.chain === transaction.chain);

    if (existed.length > 0) {
      return [new TransactionError(BasicTxErrorType.DUPLICATE_TRANSACTION)];
    }

    return [];
  }

  public async generalValidate (validationInput: SWTransactionInput): Promise<SWTransactionResponse> {
    const validation = {
      ...validationInput,
      errors: validationInput.errors || [],
      warnings: validationInput.warnings || []
    };
    const { additionalValidator, address, chain, transaction } = validation;

    // Check duplicate transaction
    validation.errors.push(...this.checkDuplicate(validationInput));

    // Return unsupported error if not found transaction
    if (!transaction) {
      validation.errors.push(new TransactionError(BasicTxErrorType.UNSUPPORTED));
    }

    const validationResponse: SWTransactionResponse = {
      status: undefined,
      ...validation
    };

    // Estimate fee
    const estimateFee: AmountData = {
      symbol: '',
      decimals: 0,
      value: ''
    };

    const chainInfo = this.chainService.getChainInfoByKey(chain);

    if (chainInfo) {
      validationResponse.errors.push(new TransactionError(BasicTxErrorType.INTERNAL_ERROR, "Can't find network"));
    }

    const { decimals, symbol } = _getChainNativeTokenBasicInfo(chainInfo);

    estimateFee.decimals = decimals;
    estimateFee.symbol = symbol;

    if (transaction) {
      if (isSubstrateTransaction(transaction)) {
        estimateFee.value = (await transaction.paymentInfo(address)).partialFee.toString();
      } else {
        const web3 = this.chainService.getEvmApi(chain);

        if (!web3) {
          validationResponse.errors.push(new TransactionError(BasicTxErrorType.CHAIN_DISCONNECTED));
        } else {
          const gasPrice = await web3.api.eth.getGasPrice();
          const gasLimit = await web3.api.eth.estimateGas(transaction);

          estimateFee.value = (gasLimit * parseInt(gasPrice)).toString();
        }
      }
    }

    validationResponse.estimateFee = estimateFee;

    // Read-only account
    const pair = keyring.getPair(address);

    if (!pair) {
      validationResponse.errors.push(new TransactionError(BasicTxErrorType.INTERNAL_ERROR, 'Can\'t find account'));
    } else {
      if (pair.meta?.isReadOnly) {
        validationResponse.errors.push(new TransactionError(BasicTxErrorType.INTERNAL_ERROR, 'This is read-only account'));
      }
    }

    // Balance
    const transferNative = validationResponse.transferNativeAmount || '0';
    const nativeTokenInfo = this.chainService.getNativeTokenInfo(chain);

    const balance = await this.#balanceService.getFreeBalance(chain, address, this.chainService.getSubstrateApiMap(), this.chainService.getEvmApiMap());

    const existentialDeposit = nativeTokenInfo.minAmount || '0';

    const feeNum = parseInt(estimateFee.value);
    const balanceNum = parseInt(balance);
    const edNum = parseInt(existentialDeposit);
    const transferNativeNum = parseInt(transferNative);

    if (transferNativeNum + feeNum > balanceNum) {
      validationResponse.errors.push(new TransactionError(BasicTxErrorType.NOT_ENOUGH_BALANCE));
    } else {
      if (balanceNum - (transferNativeNum + feeNum) > edNum) {
        // Todo add message
        validationResponse.warnings.push(new TransactionWarning(BasicTxWarningCode.NOT_ENOUGH_EXISTENTIAL_DEPOSIT, ''));
      }
    }

    // Validate transaction with additionalValidator method
    additionalValidator && await additionalValidator(validationResponse);

    return validationResponse;
  }

  public getTransactionSubject () {
    return this.transactionSubject;
  }

  private fillTransactionDefaultInfo (transaction: SWTransactionInput): SWTransaction {
    const isInternal = !transaction.url;

    return {
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
      errors: transaction.errors || [],
      warnings: transaction.warnings || [],
      url: transaction.url || EXTENSION_REQUEST_URL,
      status: ExtrinsicStatus.PENDING,
      isInternal,
      id: getTransactionId(transaction.chainType, transaction.chain, isInternal),
      extrinsicHash: ''
    } as SWTransaction;
  }

  public async addTransaction (inputTransaction: SWTransactionInput): Promise<TransactionEmitter> {
    const transactions = this.transactions;
    // Fill transaction default info
    const transaction = this.fillTransactionDefaultInfo(inputTransaction);

    // Add Transaction
    transactions[transaction.id] = transaction;
    this.transactionSubject.next({ ...transactions });

    console.log(transaction);

    // Send transaction
    return await this.sendTransaction(transaction);
  }

  public generateBeforeHandleResponseErrors (errors: TransactionError[]): SWTransactionResponse {
    return {
      errors,
      additionalValidator: undefined,
      address: '',
      chain: '',
      chainType: ChainType.SUBSTRATE,
      data: undefined,
      extrinsicType: ExtrinsicType.UNKNOWN,
      transferNativeAmount: undefined,
      url: undefined,
      warnings: []
    };
  }

  public async handleTransaction (transaction: SWTransactionInput): Promise<SWTransactionResponse> {
    const validatedTransaction = await this.generalValidate(transaction);
    const stopByErrors = validatedTransaction.errors.length > 0;
    const stopByWarnings = validatedTransaction.warnings.length > 0 && !validatedTransaction.ignoreWarnings;

    if (stopByErrors || stopByWarnings) {
      return validatedTransaction;
    }

    const emitter = await this.addTransaction(validatedTransaction);

    await new Promise<void>((resolve) => {
      emitter.on('extrinsicHash', (data: TransactionEventResponse) => {
        validatedTransaction.extrinsicHash = data.extrinsicHash;
        resolve();
      });

      emitter.on('error', (data: TransactionEventResponse) => {
        if (data.errors.length > 0) {
          validatedTransaction.errors.push(...data.errors);
          resolve();
        }
      });
    });

    return validatedTransaction;
  }

  private async sendTransaction (transaction: SWTransaction): Promise<TransactionEmitter> {
    // Send Transaction
    const emitter = transaction.chainType === 'substrate' ? this.signAndSendSubstrateTransaction(transaction) : (await this.signAndSendEvmTransaction(transaction));

    emitter.on('extrinsicHash', (data: TransactionEventResponse) => {
      this.onHasTransactionHash(data);
    });

    emitter.on('success', (data: TransactionEventResponse) => {
      this.onSuccess(data);
    });

    emitter.on('error', (data: TransactionEventResponse) => {
      this.onFailed({ ...data, errors: [...data.errors, new TransactionError(BasicTxErrorType.INTERNAL_ERROR)] });
    });

    // Todo: handle any event with transaction.eventsHandler

    return emitter;
  }

  private removeTransaction (id: string): void {
    if (this.transactions[id]) {
      delete this.transactions[id];
      this.transactionSubject.next({ ...this.transactions });
    }
  }

  private updateTransaction (id: string, data: Partial<Omit<SWTransaction, 'id'>>): void {
    const transaction = this.transactions[id];

    if (transaction) {
      this.transactions[id] = {
        ...transaction,
        ...data
      };
    }
  }

  private getTransactionLink (id: string): string | undefined {
    const transaction = this.getTransaction(id);
    const chainInfo = this.chainService.getChainInfoByKey(transaction.chain);

    if (transaction.chainType === ChainType.EVM) {
      const explorerLink = chainInfo?.evmInfo?.blockExplorer;

      if (explorerLink) {
        return (`${explorerLink}${explorerLink.endsWith('/') ? '' : '/'}tx/${transaction.extrinsicHash}`);
      }
    } else {
      const explorerLink = chainInfo?.substrateInfo?.blockExplorer;

      if (explorerLink) {
        return (`${explorerLink}${explorerLink.endsWith('/') ? '' : '/'}extrinsic/${transaction.extrinsicHash}`);
      }
    }

    return undefined;
  }

  private onHasTransactionHash ({ extrinsicHash, id }: TransactionEventResponse) {
    // Todo: Write pending transaction history
    this.updateTransaction(id, { extrinsicHash, status: ExtrinsicStatus.PROCESSING });
    console.log(`Transaction "${id}" is submitted with hash ${extrinsicHash || ''}`);
  }

  private onSuccess ({ id }: TransactionEventResponse) {
    // Todo: Write success transaction history
    const transaction = this.getTransaction(id);

    this.updateTransaction(id, { status: ExtrinsicStatus.SUCCESS });
    console.log('Transaction completed', id, transaction.extrinsicHash);
    NotificationService.createNotification('Transaction completed', `Transaction ${transaction?.extrinsicHash} completed`, this.getTransactionLink(id));
  }

  private onFailed ({ errors, id }: TransactionEventResponse) {
    // Todo: Write failed transaction history
    const transaction = this.getTransaction(id);

    if (transaction) {
      this.updateTransaction(id, { status: ExtrinsicStatus.FAIL, errors });
      console.log('Transaction failed', id, transaction.extrinsicHash);
      NotificationService.createNotification('Transaction failed', `Transaction ${transaction?.extrinsicHash} failed`, this.getTransactionLink(id));
    }

    console.error(errors);
  }

  public generateHashPayload (chain: string, transaction: TransactionConfig): HexString {
    const chainInfo = this.chainService.getChainInfoByKey(chain);

    const txObject: Web3Transaction = {
      nonce: transaction.nonce || 1,
      from: transaction.from as string,
      gasPrice: anyNumberToBN(transaction.gasPrice).toNumber(),
      gasLimit: anyNumberToBN(transaction.gas).toNumber(),
      to: transaction.to !== undefined ? transaction.to : '',
      value: anyNumberToBN(transaction.value).toNumber(),
      data: transaction.data ? transaction.data : '',
      chainId: _getEvmChainId(chainInfo)
    };

    const data: Input = [
      txObject.nonce,
      txObject.gasPrice,
      txObject.gasLimit,
      txObject.to,
      txObject.value,
      txObject.data,
      txObject.chainId,
      new Uint8Array([0x00]),
      new Uint8Array([0x00])
    ];

    const encoded = RLP.encode(data);

    return u8aToHex(encoded);
  }

  private async signAndSendEvmTransaction ({ address,
    chain,
    id,
    transaction,
    url }: SWTransaction): Promise<TransactionEmitter> {
    const payload = (transaction as EvmSendTransactionRequest);
    const chainInfo = this.chainService.getChainInfoByKey(chain);

    const { account } = payload;

    // Set unique nonce to avoid transaction errors
    if (!payload.nonce) {
      const evmApi = this.chainService.getEvmApi(chain);

      payload.nonce = await evmApi.api.eth.getTransactionCount(address);
    }

    if (!payload.chainId) {
      payload.chainId = chainInfo.evmInfo?.evmChainId ?? 1;
    }

    // Autofill from
    if (!payload.from) {
      payload.from = address;
    }

    const isExternal = !!account.isExternal;

    // generate hashPayload for EVM transaction
    payload.hashPayload = this.generateHashPayload(chain, payload);

    const emitter = new EventEmitter<TransactionEventMap>();

    const txObject: Web3Transaction = {
      nonce: payload.nonce || 1,
      from: payload.from as string,
      gasPrice: anyNumberToBN(payload.gasPrice).toNumber(),
      gasLimit: anyNumberToBN(payload.gas).toNumber(),
      to: payload.to !== undefined ? payload.to : '',
      value: anyNumberToBN(payload.value).toNumber(),
      data: payload.data ? payload.data : '',
      chainId: payload.chainId
    };

    const eventData: TransactionEventResponse = {
      id,
      errors: [],
      warnings: []
    };

    this.requestService.addConfirmation(id, url || EXTENSION_REQUEST_URL, 'evmSendTransactionRequest', payload, {})
      .then(({ isApproved, payload }) => {
        if (isApproved) {
          let signedTransaction: string | undefined;

          if (!payload) {
            throw new EvmProviderError(EvmProviderErrorType.UNAUTHORIZED, 'Bad signature');
          }

          const web3Api = this.chainService.getEvmApi(chain).api;

          if (!isExternal) {
            signedTransaction = payload;
          } else {
            const signed = parseTxAndSignature(txObject, payload as `0x${string}`);

            const recover = web3Api.eth.accounts.recoverTransaction(signed);

            if (recover.toLowerCase() !== account.address.toLowerCase()) {
              throw new EvmProviderError(EvmProviderErrorType.UNAUTHORIZED, 'Bad signature');
            }

            signedTransaction = signed;
          }

          signedTransaction && web3Api.eth.sendSignedTransaction(signedTransaction)
            .once('transactionHash', (hash) => {
              eventData.extrinsicHash = hash;
              emitter.emit('extrinsicHash', eventData);
            })
            .once('receipt', (rs) => {
              emitter.emit('success', eventData);
            })
            .once('error', (e) => {
              eventData.errors.push(new TransactionError(BasicTxErrorType.SEND_TRANSACTION_FAILED, e.message));
              emitter.emit('error', eventData);
            })
            .catch((e: Error) => {
              eventData.errors.push(new TransactionError(BasicTxErrorType.UNABLE_TO_SEND, e.message));
              emitter.emit('error', eventData);
            });
        } else {
          this.removeTransaction(id);
          eventData.errors.push(new TransactionError(BasicTxErrorType.USER_REJECT_REQUEST, 'User Rejected'));
          emitter.emit('error', eventData);
        }
      })
      .catch((e: Error) => {
        this.removeTransaction(id);
        eventData.errors.push(new TransactionError(BasicTxErrorType.UNABLE_TO_SIGN, e.message));

        emitter.emit('error', eventData);
      });

    return emitter;
  }

  private signAndSendSubstrateTransaction ({ address, id, transaction, url }: SWTransaction): TransactionEmitter {
    const emitter = new EventEmitter<TransactionEventMap>();
    const eventData: TransactionEventResponse = {
      id,
      errors: [],
      warnings: []
    };

    (transaction as SubmittableExtrinsic).signAsync(address, {
      signer: {
        signPayload: async (payload: SignerPayloadJSON) => {
          const signing = await this.requestService.signInternalTransaction(id, url || EXTENSION_REQUEST_URL, address, payload);

          return {
            id: (new Date()).getTime(),
            signature: signing.signature
          } as SignerResult;
        }
      } as Signer
    }).then((rs) => {
      // Handle and emit event from runningTransaction
      rs.send().then((result) => {
        eventData.extrinsicHash = result.toHex();
        emitter.emit('extrinsicHash', eventData);
      }).then(() => {
        emitter.emit('success', eventData);
      }).catch((e: Error) => {
        eventData.errors.push(new TransactionError(BasicTxErrorType.SEND_TRANSACTION_FAILED, e.message));
        emitter.emit('error', eventData);
      });
      // Todo add more event listener to handle and update history for XCM transaction
    }).catch((e: Error) => {
      this.removeTransaction(id);
      eventData.errors.push(new TransactionError(BasicTxErrorType.UNABLE_TO_SEND, e.message));
      emitter.emit('error', eventData);
    });

    return emitter;
  }
}
