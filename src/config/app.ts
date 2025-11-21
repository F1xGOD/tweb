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
const envApiId = Number.parseInt(`${import.meta.env.VITE_API_ID ?? ''}`, 10);
const defaultApiId = Number.isFinite(envApiId) ? envApiId : 0;
const defaultApiHash = import.meta.env.VITE_API_HASH;

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

const hasCustomCredentials = TELEGRAM_CLIENT.apiId !== undefined || TELEGRAM_CLIENT.apiHash !== undefined;

if(App.isMainDomain && !hasCustomCredentials) { // use Webogram credentials then
  App.id = 2496;
  App.hash = '8da85b0d5bfe62527e5b244c209159c3';
}

export default App;
