import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { JSONFilePreset } from 'lowdb/node';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { 
  ChatDbSchema, 
  ChatDb, 
  Thread, 
  ThreadSchema,
  CreateThreadInput 
} from '../types/ai.schemas';

@Injectable()
export class ThreadService {
  private db: any;
  private filePath: string;

  constructor() {
    // Salva o arquivo em /studio/api/data/
    this.filePath = join(process.cwd(), 'data', 'ai-chat.json');
  }

  async init() {
    try {
      // Garantir que o diretório existe
      const dir = dirname(this.filePath);
      
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Definir estrutura padrão
      const defaultData: ChatDb = {
        threads: {},
        messages: {},
        metadata: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: "1.0.0"
        }
      };

      // Inicializar com JSONFilePreset
      this.db = await JSONFilePreset(this.filePath, defaultData);
    } catch (error) {
      console.error('Error initializing AI chat database:', error);
      throw error;
    }
  }

  async createThread(input: CreateThreadInput): Promise<Thread> {
    await this.ensureInitialized();
    
    const thread: Thread = {
      threadId: uuidv4(),
      title: input.title,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messageCount: 0,
      messageIds: []
    };

    // Validar com schema
    const validated = ThreadSchema.parse(thread);
    
    await this.db.read();
    this.db.data.threads[validated.threadId] = validated;
    this.db.data.metadata.updated_at = new Date().toISOString();
    await this.db.write();
    
    return validated;
  }

  async getThread(threadId: string): Promise<Thread> {
    await this.ensureInitialized();
    await this.db.read();
    
    const thread = this.db.data.threads[threadId];
    if (!thread) {
      throw new NotFoundException(`Thread with ID '${threadId}' not found`);
    }
    
    return thread;
  }

  async getAllThreads(): Promise<Thread[]> {
    await this.ensureInitialized();
    await this.db.read();
    
    return Object.values(this.db.data.threads).sort(
      (a: any, b: any) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    ) as Thread[];
  }

  async updateThread(threadId: string, updates: Partial<Thread>): Promise<Thread> {
    await this.ensureInitialized();
    await this.db.read();
    
    const thread = this.db.data.threads[threadId];
    if (!thread) {
      throw new NotFoundException(`Thread with ID '${threadId}' not found`);
    }

    const updatedThread = { ...thread, ...updates, lastActivity: new Date().toISOString() };
    const validated = ThreadSchema.parse(updatedThread);
    
    this.db.data.threads[threadId] = validated;
    this.db.data.metadata.updated_at = new Date().toISOString();
    await this.db.write();
    
    return validated;
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.ensureInitialized();
    await this.db.read();
    
    if (!this.db.data.threads[threadId]) {
      throw new NotFoundException(`Thread with ID '${threadId}' not found`);
    }

    // Remover thread
    delete this.db.data.threads[threadId];
    
    // Remover todas as mensagens da thread
    const messageIds = Object.keys(this.db.data.messages).filter(
      messageId => this.db.data.messages[messageId].threadId === threadId
    );
    
    messageIds.forEach(messageId => {
      delete this.db.data.messages[messageId];
    });

    this.db.data.metadata.updated_at = new Date().toISOString();
    await this.db.write();
  }

  async addMessageToThread(threadId: string, messageId: string): Promise<void> {
    const thread = await this.getThread(threadId);
    
    const updatedMessageIds = [...thread.messageIds, messageId];
    const messageCount = updatedMessageIds.length;
    
    await this.updateThread(threadId, {
      messageIds: updatedMessageIds,
      messageCount
    });
  }

  private async ensureInitialized() {
    if (!this.db) {
      await this.init();
    }
  }
}
