export type * from './common';

export function createContext(wasm: BufferSource): Promise<Context>;
