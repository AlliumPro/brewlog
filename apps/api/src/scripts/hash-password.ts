import { text } from 'node:stream/consumers';

import { hash } from '@node-rs/argon2';

/**
 * Prints an argon2id hash for AUTH_PASSWORD_HASH.
 *
 * The password is read from stdin, never from argv: a command-line argument lands in shell
 * history and in the process list, where anyone on the machine can read it.
 *
 *   printf '%s' 'your password' | npm run auth:hash --workspace @brewlog/api
 */
const password = (await text(process.stdin)).replace(/\r?\n$/, '');

if (password === '') {
  throw new Error("No password on stdin. Usage: printf %s 'your password' | npm run auth:hash");
}

/**
 * One password guards the whole journal and there is no second factor behind it, so a short
 * one is refused outright rather than warned about. Length beats character classes: a
 * passphrase of ordinary words is both stronger and easier to type on a phone.
 */
const MINIMUM_LENGTH = 12;

if (password.length < MINIMUM_LENGTH) {
  throw new Error(
    `The password must be at least ${String(MINIMUM_LENGTH)} characters. A passphrase of three or four words works well.`,
  );
}

// OWASP baseline for argon2id: 19 MiB memory, 2 iterations, 1 lane.
const digest = await hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });

// eslint-disable-next-line no-console -- this is a CLI script, stdout is its interface
console.log(digest);
