declare const originalFetch: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) & typeof fetch;
declare const originalXhrOpen: {
    (method: string, url: string | URL): void;
    (method: string, url: string | URL, async: boolean, username?: string | null, password?: string | null): void;
};
//# sourceMappingURL=interceptor.d.ts.map