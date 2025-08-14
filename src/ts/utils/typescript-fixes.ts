/**
 * TypeScript compatibility fixes and polyfills
 */

// Fix for NodeListOf iteration
declare global {
  interface NodeListOf<TNode extends Node> extends NodeList {
    [Symbol.iterator](): IterableIterator<TNode>;
  }
}

// Polyfill for NodeList iteration
if (!NodeList.prototype[Symbol.iterator]) {
  NodeList.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
}

// Error type helper
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Fix for Uint8Array compatibility
export function createBlob(chunks: ArrayBuffer[]): Blob {
  return new Blob(chunks);
}

// Chrome message handler return type fix
export function handleChromeMessage(
  handler: (message: any, sender: any, sendResponse: any) => void | boolean | Promise<any>
) {
  return (message: any, sender: any, sendResponse: any) => {
    const result = handler(message, sender, sendResponse);
    if (result instanceof Promise) {
      result.then(sendResponse);
      return true;
    }
    return result;
  };
}