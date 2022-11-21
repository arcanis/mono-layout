import * as TextLayoutModule from './common';
export type {TextLayout} from './common';

declare const enginePromise: Promise<typeof TextLayoutModule>;
export default enginePromise;
