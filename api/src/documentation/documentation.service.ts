import { Injectable, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { JSONFilePreset } from 'lowdb/node';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { z } from 'zod';
import {
  DocumentationDb,
  AppDocumentationSchema,
  FlowSchema,
  FlowStateSchema,
  VendorSchema,
  RoleSchema,
  ActivitySchema,
  StorySchema,
  TestCaseSchema,
} from "@zazos/schemas";

type EntityConfig = { name: string; schema: any };
export const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  app: { name: 'App Documentation', schema: AppDocumentationSchema },
  flows: { name: 'Flow', schema: FlowSchema },
  flow_states: { name: 'Flow State', schema: FlowStateSchema },
  vendors: { name: 'Vendor', schema: VendorSchema },
  roles: { name: 'Role', schema: RoleSchema },
  activities: { name: 'Activity', schema: ActivitySchema },
  stories: { name: 'Story', schema: StorySchema },
  test_cases: { name: 'Test Case', schema: TestCaseSchema },
};

@Injectable()
export class DocumentationService implements OnModuleInit {
  private dbMap: Map<string, any> = new Map();
  private workspacePath: string;

  constructor() {
    this.workspacePath = process.env.WORKSPACE_PATH || join(process.cwd(), '..', '..');
  }

  async onModuleInit() {}

  private resolveSelection(selection?: { customer?: string; namespace?: string; app?: string }) {
    const customer = selection?.customer || process.env.DEFAULT_CUSTOMER || 'quero';
    const namespace = selection?.namespace || process.env.DEFAULT_NAMESPACE || 'quero';
    const app = selection?.app || process.env.DEFAULT_APP || 'flow';
    return { customer, namespace, app };
  }

  private async getDb(selection?: { customer?: string; namespace?: string; app?: string }) {
    const { customer, namespace, app } = this.resolveSelection(selection);
    const key = `${customer}/${namespace}/${app}`;
    if (this.dbMap.has(key)) {
      return this.dbMap.get(key);
    }

    const filePath = join(
      this.workspacePath,
      'preview_customers',
      customer,
      'apps',
      namespace,
      app,
      'documentation.json',
    );

    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const defaultData = {
      flows: {},
      flow_states: {},
      vendors: {},
      roles: {},
      activities: {},
      stories: {},
      test_cases: {},
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    const db = await JSONFilePreset(filePath, defaultData);
    this.dbMap.set(key, db);
    return db;
  }

  private async ensureInitialized(selection?: { customer?: string; namespace?: string; app?: string }) {
    return this.getDb(selection);
  }

  async getAll(selection?: { customer?: string; namespace?: string; app?: string }): Promise<DocumentationDb> {
    const db = await this.getDb(selection);
    await db.read();
    return db.data;
  }

  async getApp(selection?: { customer?: string; namespace?: string; app?: string }) {
    const db = await this.getDb(selection);
    await db.read();
    return db.data.app;
  }

  async updateApp(selection: { customer?: string; namespace?: string; app?: string }, data: any) {
    const db = await this.getDb(selection);
    const config = ENTITY_CONFIGS.app;
    const validated = config.schema.parse(data);
    await db.read();
    db.data.app = validated;
    db.data.metadata.updated_at = new Date().toISOString();
    await db.write();
    return validated;
  }

  // Generic methods for all entities
  async getEntity(selection: { customer?: string; namespace?: string; app?: string }, entityType: string) {
    const db = await this.getDb(selection);
    await db.read();
    return db.data[entityType];
  }

  async createEntity(selection: { customer?: string; namespace?: string; app?: string }, entityType: string, data: any) {
    const config = ENTITY_CONFIGS[entityType];
    if (!config) {
      throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }

    const validated = config.schema.parse(data);
    const db = await this.getDb(selection);
    await db.read();
    
    if (db.data[entityType][validated.slug]) {
      throw new BadRequestException(`${config.name} with slug '${validated.slug}' already exists`);
    }
    
    db.data[entityType][validated.slug] = validated;
    db.data.metadata.updated_at = new Date().toISOString();
    await db.write();
    return validated;
  }

  async updateEntity(selection: { customer?: string; namespace?: string; app?: string }, entityType: string, slug: string, data: any) {
    const config = ENTITY_CONFIGS[entityType];
    if (!config) {
      throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }

    const validated = config.schema.parse(data);
    const db = await this.getDb(selection);
    await db.read();
    
    if (!db.data[entityType][slug]) {
      throw new NotFoundException(`${config.name} with slug '${slug}' not found`);
    }
    
    // If slug changed, update the key
    if (validated.slug !== slug) {
      delete db.data[entityType][slug];
    }
    
    db.data[entityType][validated.slug] = validated;
    db.data.metadata.updated_at = new Date().toISOString();
    await db.write();
    return validated;
  }

  async deleteEntity(selection: { customer?: string; namespace?: string; app?: string }, entityType: string, slug: string) {
    const config = ENTITY_CONFIGS[entityType];
    if (!config) {
      throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }

    const db = await this.getDb(selection);
    await db.read();
    
    if (!db.data[entityType][slug]) {
      throw new NotFoundException(`${config.name} with slug '${slug}' not found`);
    }
    
    delete db.data[entityType][slug];
    db.data.metadata.updated_at = new Date().toISOString();
    await db.write();
    return { success: true };
  }
}
