import * as bcrypt from 'bcrypt';

/**
 * Utilidad de hashing (SRP).
 * No depende de Nest, es testable.
 */
export class CryptoUtil {
  static async hash(value: string, rounds: number): Promise<string> {
    return bcrypt.hash(value, rounds);
  }

  static async compare(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }
}
