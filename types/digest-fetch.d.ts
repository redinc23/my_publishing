declare module 'digest-fetch' {
  export default class DigestFetch {
    constructor(username: string, password: string, options?: Record<string, unknown>);
    fetch(input: string | URL, init?: RequestInit): Promise<Response>;
  }
}
