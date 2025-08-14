if (!NodeList.prototype[Symbol.iterator]) {
    NodeList.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
}
export function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
export function createBlob(chunks) {
    return new Blob(chunks);
}
export function handleChromeMessage(handler) {
    return (message, sender, sendResponse) => {
        const result = handler(message, sender, sendResponse);
        if (result instanceof Promise) {
            result.then(sendResponse);
            return true;
        }
        return result;
    };
}
