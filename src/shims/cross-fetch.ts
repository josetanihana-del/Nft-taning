// Clean shim for cross-fetch in browser/vite environment
const nativeFetch =
  typeof window !== 'undefined' && window.fetch
    ? window.fetch.bind(window)
    : typeof globalThis !== 'undefined' && globalThis.fetch
    ? globalThis.fetch.bind(globalThis)
    : undefined;

export default nativeFetch;
export const fetch = nativeFetch;
export const Headers =
  typeof window !== 'undefined'
    ? window.Headers
    : typeof globalThis !== 'undefined'
    ? globalThis.Headers
    : undefined;
export const Request =
  typeof window !== 'undefined'
    ? window.Request
    : typeof globalThis !== 'undefined'
    ? globalThis.Request
    : undefined;
export const Response =
  typeof window !== 'undefined'
    ? window.Response
    : typeof globalThis !== 'undefined'
    ? globalThis.Response
    : undefined;
