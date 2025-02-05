import { injectable } from 'inversify'; // @version ^6.0.0
import crypto from 'crypto';
import argon2 from 'argon2'; // @version ^0.31.0
import { authConfig } from '../../config/auth.config';
import { InternalServerError } from '../../utils/errors';
import { Logger } from '../../utils/logger';

/**
 * Interface for encrypted data structure with authentication
 */
export interface EncryptedData {
  encryptedValue: string;
  iv: string;
  authTag: string;
  keyVersion: string;
}

/**
 * Service responsible for handling data encryption, decryption, and password hashing
 * Implements AES-256-GCM encryption with secure key management and Argon2 password hashing
 */
@injectable()
export class EncryptionService {
  private encryptionKeys: Map<string, Buffer>;
  private currentKeyVersion: string;
  private readonly algorithm = 'aes-256-gcm';
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.validateEnvironment();
    this.encryptionKeys = new Map();
    this.initializeKeys();
    this.setupKeyRotation();
  }

  /**
   * Validates required environment variables
   */
  private validateEnvironment(): void {
    if (!process.env.ENCRYPTION_KEY) {
      throw new InternalServerError('Missing encryption key configuration');
    }
  }

  /**
   * Initializes encryption keys with secure key management
   */
  private initializeKeys(): void {
    const initialKey = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64');
    const initialVersion = crypto.createHash('sha256')
      .update(initialKey)
      .digest('hex')
      .slice(0, 8);

    this.encryptionKeys.set(initialVersion, initialKey);
    this.currentKeyVersion = initialVersion;

    this.logger.info('Encryption keys initialized', { keyVersion: this.currentKeyVersion });
  }

  /**
   * Sets up automatic key rotation schedule
   */
  private setupKeyRotation(): void {
    const KEY_ROTATION_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 days
    setInterval(() => this.rotateKeys(), KEY_ROTATION_INTERVAL);
  }

  /**
   * Rotates encryption keys securely
   */
  private async rotateKeys(): Promise<void> {
    try {
      const newKey = crypto.randomBytes(32);
      const newVersion = crypto.createHash('sha256')
        .update(newKey)
        .digest('hex')
        .slice(0, 8);

      this.encryptionKeys.set(newVersion, newKey);
      this.currentKeyVersion = newVersion;

      // Keep only the last 2 versions for decryption of existing data
      const versions = Array.from(this.encryptionKeys.keys());
      if (versions.length > 2) {
        this.encryptionKeys.delete(versions[0]);
      }

      this.logger.info('Encryption keys rotated successfully', { newVersion });
    } catch (error) {
      this.logger.error('Key rotation failed', { error });
      throw new InternalServerError('Failed to rotate encryption keys');
    }
  }

  /**
   * Encrypts data using AES-256-GCM with authentication
   */
  public async encrypt(data: any): Promise<EncryptedData> {
    try {
      const iv = crypto.randomBytes(16);
      const key = this.encryptionKeys.get(this.currentKeyVersion)!;
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      const jsonData = JSON.stringify(data);
      
      const encrypted = Buffer.concat([
        cipher.update(jsonData, 'utf8'),
        cipher.final()
      ]);
      
      const authTag = cipher.getAuthTag();

      const result: EncryptedData = {
        encryptedValue: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        keyVersion: this.currentKeyVersion
      };

      return result;
    } catch (error) {
      this.logger.error('Encryption failed', { error });
      throw new InternalServerError('Failed to encrypt data');
    }
  }

  /**
   * Decrypts data using AES-256-GCM with authentication verification
   */
  public async decrypt(encryptedData: EncryptedData): Promise<any> {
    try {
      const key = this.encryptionKeys.get(encryptedData.keyVersion);
      if (!key) {
        throw new InternalServerError('Encryption key version not found');
      }

      const iv = Buffer.from(encryptedData.iv, 'base64');
      const authTag = Buffer.from(encryptedData.authTag, 'base64');
      const encrypted = Buffer.from(encryptedData.encryptedValue, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      this.logger.error('Decryption failed', { error });
      throw new InternalServerError('Failed to decrypt data');
    }
  }

  /**
   * Hashes passwords using Argon2id with secure parameters
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 4,
        saltLength: 32,
        hashLength: 32
      });

      return hash;
    } catch (error) {
      this.logger.error('Password hashing failed', { error });
      throw new InternalServerError('Failed to hash password');
    }
  }

  /**
   * Verifies passwords using Argon2id
   */
  public async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(hashedPassword, password);
    } catch (error) {
      this.logger.error('Password verification failed', { error });
      throw new InternalServerError('Failed to verify password');
    }
  }

  /**
   * Securely cleans up sensitive data from memory
   */
  private secureClearBuffer(buffer: Buffer): void {
    crypto.randomFillSync(buffer, 0, buffer.length);
  }
}