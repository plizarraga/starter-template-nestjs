import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { Environment } from '../platform/config/environment';

const saltLength = 16;
const derivedKeyLength = 64;

type PasswordHash = {
  derivedKey: Buffer;
  maxmem: number;
  n: number;
  p: number;
  r: number;
  salt: Buffer;
};

@Injectable()
export class PasswordService {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async hash(password: string): Promise<string> {
    const parameters = this.parameters();
    const salt = randomBytes(saltLength);
    const derivedKey = await this.scrypt(password, salt, parameters);

    return [
      'scrypt',
      parameters.N,
      parameters.r,
      parameters.p,
      parameters.maxmem,
      salt.toString('base64url'),
      derivedKey.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const hash = this.parse(encodedHash);
    if (hash === undefined) {
      return false;
    }

    const derivedKey = await this.scrypt(password, hash.salt, {
      N: hash.n,
      maxmem: hash.maxmem,
      p: hash.p,
      r: hash.r,
    });

    return timingSafeEqual(hash.derivedKey, derivedKey);
  }

  async consumeVerificationCost(password: string): Promise<void> {
    await this.scrypt(password, randomBytes(saltLength), this.parameters());
  }

  private parameters() {
    return {
      N: this.config.getOrThrow<number>('SCRYPT_N'),
      maxmem: this.config.getOrThrow<number>('SCRYPT_MAXMEM'),
      p: this.config.getOrThrow<number>('SCRYPT_P'),
      r: this.config.getOrThrow<number>('SCRYPT_R'),
    };
  }

  private scrypt(
    password: string,
    salt: Buffer,
    parameters: { N: number; maxmem: number; p: number; r: number },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scryptCallback(
        password,
        salt,
        derivedKeyLength,
        parameters,
        (error, derivedKey) => {
          if (error !== null) {
            reject(error);
            return;
          }
          resolve(derivedKey);
        },
      );
    });
  }

  private parse(encodedHash: string): PasswordHash | undefined {
    const [algorithm, n, r, p, maxmem, salt, derivedKey] =
      encodedHash.split('$');
    const parsed = [n, r, p, maxmem].map(Number);

    if (
      algorithm !== 'scrypt' ||
      parsed.some(
        (parameter) => !Number.isSafeInteger(parameter) || parameter < 1,
      ) ||
      salt === undefined ||
      derivedKey === undefined
    ) {
      return undefined;
    }

    const [parsedN, parsedR, parsedP, parsedMaxmem] = parsed;
    const parsedSalt = Buffer.from(salt, 'base64url');
    const parsedDerivedKey = Buffer.from(derivedKey, 'base64url');
    if (
      parsedSalt.length < saltLength ||
      parsedDerivedKey.length !== derivedKeyLength
    ) {
      return undefined;
    }

    return {
      derivedKey: parsedDerivedKey,
      maxmem: parsedMaxmem,
      n: parsedN,
      p: parsedP,
      r: parsedR,
      salt: parsedSalt,
    };
  }
}
