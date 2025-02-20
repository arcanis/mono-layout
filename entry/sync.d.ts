import type {Context} from './common';

export type * from './common';

export function createContext(wasm: ArrayBufferView | ArrayBuffer): Context;
