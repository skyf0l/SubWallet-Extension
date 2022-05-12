// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OnChangeCb } from '../types';

import React from 'react';

export type Transform = (value: any, index: number) => any;

export interface DefaultProps {
  callOnResult?: OnChangeCb;
  [index: string]: any;
}

export interface Options {
  at?: Uint8Array | string;
  atProp?: string;
  callOnResult?: OnChangeCb;
  fallbacks?: string[];
  isMulti?: boolean;
  params?: unknown[];
  paramName?: string;
  paramPick?: (props: any) => unknown;
  paramValid?: boolean;
  propName?: string;
  skipIf?: (props: any) => boolean;
  transform?: Transform;
  withIndicator?: boolean;
}

export type RenderFn = (value?: any) => React.ReactNode;

export type StorageTransform = (input: any, index: number) => unknown | null;

export type HOC = (Component: React.ComponentType<unknown>, defaultProps?: DefaultProps, render?: RenderFn) => React.ComponentType<unknown>;

export interface ApiMethod {
  name: string;
  section?: string;
}

export type ComponentRenderer = (render: RenderFn, defaultProps?: DefaultProps) => React.ComponentType<any>;

export type OmitProps<T, K> = Pick<T, Exclude<keyof T, K>>;
export type SubtractProps<T, K> = OmitProps<T, keyof K>;
