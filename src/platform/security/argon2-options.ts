import * as argon2 from 'argon2';

export type Argon2Parameters = {
  memoryCost: number;
  parallelism: number;
  timeCost: number;
};

export function toArgon2Options(
  parameters: Argon2Parameters,
): argon2.HashOptions {
  return { type: argon2.argon2id, ...parameters };
}
