import type {Context} from './common';

export type * from './common';

export function createContext(wasm: BufferSource): Context;
