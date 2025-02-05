// @package @prisma/client version ^5.4.0
// @package crypto-js version ^4.1.1
// @package winston version ^3.10.0
// @package zod version ^3.22.0

import { PrismaClient } from '@prisma/client';
import { AES, enc } from 'crypto-js';
import * as winston from 'winston';
import { z } from 'zod';
import {
  Organization,
  OrganizationType,
  OrganizationStatus,
  OrganizationSettings,
  organizationSchema,
  SUBSCRIPTION_TIERS,
  MAX_USERS_BY_TIER,
  MAX_CHECKS_BY_TIER
} from '../../types/organization.types';

// Constants for the organization model
const TABLE_NAME = 'organizations';
const ENCRYPTION_KEY = process.env.ORGANIZATION_ENCRYPTION_KEY || '';
const SENSITIVE_FIELDS = ['taxId', 'bankingDetails', 'apiKeys'] as const;
const DEFAULT_PAGE_SIZE = 20;

// Input type for organization creation
interface OrganizationCreateInput extends Omit<Organization, 'id' | 'created_at' | 'updated_at'> {
  domain: string;
}

// Input type for organization update
interface OrganizationUpdateInput extends Partial<Omit<Organization, 'id' | 'created_at' | 'updated_at'>> {}

/**
 * Organization Model class for handling all organization-related database operations
 * with built-in security, audit logging, and subscription management
 */
export class OrganizationModel {
  private readonly prisma: PrismaClient;
  private readonly logger: winston.Logger;
  private readonly tableName: string;

  constructor(prisma: PrismaClient, logger: winston.Logger) {
    this.prisma = prisma;
    this.logger = logger;
    this.tableName = TABLE_NAME;
  }

  /**
   * Encrypts sensitive organization data fields
   * @param data - Object containing fields to encrypt
   * @returns Object with encrypted sensitive fields
   */
  private encryptSensitiveFields<T extends Record<string, any>>(data: T): T {
    const encryptedData = { ...data };
    SENSITIVE_FIELDS.forEach(field => {
      if (field in data) {
        encryptedData[field] = AES.encrypt(
          JSON.stringify(data[field]),
          ENCRYPTION_KEY
        ).toString();
      }
    });
    return encryptedData;
  }

  /**
   * Decrypts sensitive organization data fields
   * @param data - Object containing encrypted fields
   * @returns Object with decrypted sensitive fields
   */
  private decryptSensitiveFields<T extends Record<string, any>>(data: T): T {
    const decryptedData = { ...data };
    SENSITIVE_FIELDS.forEach(field => {
      if (field in data) {
        const bytes = AES.decrypt(data[field], ENCRYPTION_KEY);
        decryptedData[field] = JSON.parse(bytes.toString(enc.Utf8));
      }
    });
    return decryptedData;
  }

  /**
   * Creates a new organization with encrypted sensitive data and audit logging
   * @param data - Organization creation input data
   * @returns Created organization record
   */
  async create(data: OrganizationCreateInput): Promise<Organization> {
    try {
      // Validate input data
      const validatedData = organizationSchema.omit({ 
        id: true, 
        created_at: true, 
        updated_at: true 
      }).parse(data);

      // Encrypt sensitive fields
      const encryptedData = this.encryptSensitiveFields(validatedData);

      // Create organization record
      const organization = await this.prisma.organization.create({
        data: {
          ...encryptedData,
          status: OrganizationStatus.ACTIVE,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      // Log creation
      this.logger.info(`Organization created: ${organization.id}`, {
        action: 'create',
        table: this.tableName,
        organizationId: organization.id
      });

      // Return decrypted organization data
      return this.decryptSensitiveFields(organization);
    } catch (error) {
      this.logger.error('Failed to create organization', {
        error,
        action: 'create',
        table: this.tableName
      });
      throw error;
    }
  }

  /**
   * Retrieves an organization by ID with decrypted sensitive data
   * @param id - Organization ID
   * @returns Organization record or null if not found
   */
  async findById(id: string): Promise<Organization | null> {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id }
      });

      if (!organization) return null;

      // Log retrieval
      this.logger.info(`Organization retrieved: ${id}`, {
        action: 'findById',
        table: this.tableName,
        organizationId: id
      });

      return this.decryptSensitiveFields(organization);
    } catch (error) {
      this.logger.error('Failed to retrieve organization', {
        error,
        action: 'findById',
        table: this.tableName,
        organizationId: id
      });
      throw error;
    }
  }

  /**
   * Updates an organization with encrypted sensitive data and audit logging
   * @param id - Organization ID
   * @param data - Update data
   * @returns Updated organization record
   */
  async update(id: string, data: OrganizationUpdateInput): Promise<Organization> {
    try {
      // Validate update data
      const validatedData = organizationSchema.partial().parse(data);

      // Encrypt sensitive fields
      const encryptedData = this.encryptSensitiveFields(validatedData);

      // Update organization
      const organization = await this.prisma.organization.update({
        where: { id },
        data: {
          ...encryptedData,
          updated_at: new Date()
        }
      });

      // Log update
      this.logger.info(`Organization updated: ${id}`, {
        action: 'update',
        table: this.tableName,
        organizationId: id
      });

      return this.decryptSensitiveFields(organization);
    } catch (error) {
      this.logger.error('Failed to update organization', {
        error,
        action: 'update',
        table: this.tableName,
        organizationId: id
      });
      throw error;
    }
  }

  /**
   * Deletes an organization with audit logging
   * @param id - Organization ID
   * @returns Deleted organization record
   */
  async delete(id: string): Promise<Organization> {
    try {
      const organization = await this.prisma.organization.delete({
        where: { id }
      });

      // Log deletion
      this.logger.info(`Organization deleted: ${id}`, {
        action: 'delete',
        table: this.tableName,
        organizationId: id
      });

      return this.decryptSensitiveFields(organization);
    } catch (error) {
      this.logger.error('Failed to delete organization', {
        error,
        action: 'delete',
        table: this.tableName,
        organizationId: id
      });
      throw error;
    }
  }

  /**
   * Finds an organization by domain with decrypted sensitive data
   * @param domain - Organization domain
   * @returns Organization record or null if not found
   */
  async findByDomain(domain: string): Promise<Organization | null> {
    try {
      const organization = await this.prisma.organization.findFirst({
        where: {
          settings: {
            path: ['allowed_domains'],
            array_contains: domain
          }
        }
      });

      if (!organization) return null;

      // Log retrieval
      this.logger.info(`Organization retrieved by domain: ${domain}`, {
        action: 'findByDomain',
        table: this.tableName,
        domain
      });

      return this.decryptSensitiveFields(organization);
    } catch (error) {
      this.logger.error('Failed to retrieve organization by domain', {
        error,
        action: 'findByDomain',
        table: this.tableName,
        domain
      });
      throw error;
    }
  }

  /**
   * Updates organization subscription status and settings
   * @param id - Organization ID
   * @param tier - New subscription tier
   * @param expiryDate - New expiry date
   * @returns Updated organization record
   */
  async updateSubscription(
    id: string,
    tier: typeof SUBSCRIPTION_TIERS[number],
    expiryDate: Date
  ): Promise<Organization> {
    try {
      const organization = await this.prisma.organization.update({
        where: { id },
        data: {
          subscription_tier: tier,
          subscription_expires: expiryDate,
          settings: {
            update: {
              max_users: MAX_USERS_BY_TIER[tier],
              max_checks_per_month: MAX_CHECKS_BY_TIER[tier]
            }
          },
          updated_at: new Date()
        }
      });

      // Log subscription update
      this.logger.info(`Organization subscription updated: ${id}`, {
        action: 'updateSubscription',
        table: this.tableName,
        organizationId: id,
        tier
      });

      return this.decryptSensitiveFields(organization);
    } catch (error) {
      this.logger.error('Failed to update organization subscription', {
        error,
        action: 'updateSubscription',
        table: this.tableName,
        organizationId: id
      });
      throw error;
    }
  }
}