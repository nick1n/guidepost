import { Socket } from "node:net";
import { afterEach, beforeEach, expect } from "vitest";

const attempts: string[] = [];
const loopback = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function block(destination: string): never {
  attempts.push(destination);
  throw new Error(`External network access is disabled in tests: ${destination}. Inject a fake HTTP service instead.`);
}

// Keep local HTTP fixtures working, but never let a missing fake reach the internet.
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, receiver, args: Parameters<typeof fetch>) {
    const input = args[0];
    const url = new URL(input instanceof Request ? input.url : input);
    if (!loopback.has(url.hostname)) block(url.href);
    return Reflect.apply(target, receiver, args);
  },
});

Socket.prototype.connect = new Proxy(Socket.prototype.connect, {
  apply(target, receiver, args) {
    const options = args[0];
    // Node also passes normalized arguments as an array internally.
    const connection = Array.isArray(options) ? options[0] : options;
    const host = typeof connection === "object" ? connection.host : typeof args[1] === "string" ? args[1] : undefined;
    if (host && !loopback.has(host)) block(String(host));
    return Reflect.apply(target, receiver, args);
  },
});

beforeEach(() => {
  attempts.length = 0;
});

afterEach(() => {
  // A workflow may catch the blocked request. It must still fail the test.
  expect(attempts, "Tests must inject HTTP fakes instead of attempting external requests").toEqual([]);
});
