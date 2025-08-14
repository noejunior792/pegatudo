/**
 * TypeScript compatibility fixes and polyfills
 */
declare global {
    interface NodeListOf<TNode extends Node> extends NodeList {
        [Symbol.iterator](): IterableIterator<TNode>;
    }
}
export declare function getErrorMessage(error: unknown): string;
export declare function createBlob(chunks: ArrayBuffer[]): Blob;
export declare function handleChromeMessage(handler: (message: any, sender: any, sendResponse: any) => void | boolean | Promise<any>): (message: any, sender: any, sendResponse: any) => boolean | void;
//# sourceMappingURL=typescript-fixes.d.ts.map