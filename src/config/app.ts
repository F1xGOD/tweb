/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 *
 * Originally from:
 * https://github.com/zhukov/webogram
 * Copyright (C) 2014 Igor Zhukov <igor.beatle@gmail.com>
 * https://github.com/zhukov/webogram/blob/master/LICENSE
 */

import type {TrueDcId} from '../types';
import {resolveApiHash, resolveApiId, TELEGRAM_CLIENT} from './clientIdentity';

export const MAIN_DOMAINS = ['tweb.hostforever.org', 'webk.telegram.org'];
export const DEFAULT_BACKGROUND_SLUG = 'pattern';

const threads = Math.min(4, navigator.hardwareConcurrency ?? 4);
const FALLBACK_API_ID = 29718886;
const FALLBACK_API_HASH = 'a47426984744c41f207db51f48f9304e';
const envApiId = Number.parseInt(`${import.meta.env.VITE_API_ID ?? ''}`, 10);
const defaultApiId = Number.isFinite(envApiId) ? envApiId : FALLBACK_API_ID;
const defaultApiHash = import.meta.env.VITE_API_HASH || FALLBACK_API_HASH;

const App = {
  id: resolveApiId(defaultApiId),
  hash: resolveApiHash(defaultApiHash),
  version: TELEGRAM_CLIENT.appVersion || import.meta.env.VITE_VERSION,
  versionFull: TELEGRAM_CLIENT.appVersion || import.meta.env.VITE_VERSION_FULL,
  build: +import.meta.env.VITE_BUILD,
  langPackVersion: +import.meta.env.VITE_LANG_PACK_VERSION,
  langPackLocalVersion: +(import.meta.env.VITE_LANG_PACK_LOCAL_VERSION || 1),
  langPack: 'webk',
  langPackCode: 'en',
  domains: MAIN_DOMAINS,
  baseDcId: 2 as TrueDcId,
  isMainDomain: MAIN_DOMAINS.includes(location.hostname),
  suffix: 'K',
  threads,
  cryptoWorkers: threads
};

export default App;
