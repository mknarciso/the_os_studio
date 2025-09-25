import { Injectable, NotFoundException } from '@nestjs/common';
import { JSONFilePreset } from 'lowdb/node';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { 
  ChatDb, 
  Message, 
  MessageSchema,
  SendMessageInput 
} from '../types/ai.schemas';

@Injectable()
export class MessageService {
  private db: any;
  private filePath: string;

  constructor() {
    // Mesmo arquivo do ThreadService
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

  async createMessage(threadId: string, input: SendMessageInput, role: 'user' | 'assistant' = 'user'): Promise<Message> {
    await this.ensureInitialized();
    
    const message: Message = {
      messageId: uuidv4(),
      threadId,
      role,
      type: input.type,
      content: input.message,
      timestamp: new Date().toISOString(),
      context: input.context
    };

    // Validar com schema
    const validated = MessageSchema.parse(message);
    
    await this.db.read();
    this.db.data.messages[validated.messageId] = validated;
    this.db.data.metadata.updated_at = new Date().toISOString();
    await this.db.write();
    
    return validated;
  }

  async createAssistantMessage(threadId: string, content: string, type: 'documentation' | 'general'): Promise<Message> {
    await this.ensureInitialized();
    
    const message: Message = {
      messageId: uuidv4(),
      threadId,
      role: 'assistant',
      type,
      content,
      timestamp: new Date().toISOString()
    };

    // Validar com schema
    const validated = MessageSchema.parse(message);
    
    await this.db.read();
    this.db.data.messages[validated.messageId] = validated;
    this.db.data.metadata.updated_at = new Date().toISOString();
    await this.db.write();
    
    return validated;
  }

  async getMessage(messageId: string): Promise<Message> {
    await this.ensureInitialized();
    await this.db.read();
    
    const message = this.db.data.messages[messageId];
    if (!message) {
      throw new NotFoundException(`Message with ID '${messageId}' not found`);
    }
    
    return message;
  }

  async getThreadMessages(threadId: string): Promise<Message[]> {
    await this.ensureInitialized();
    await this.db.read();
    
    const messages = Object.values(this.db.data.messages)
      .filter((message: any) => message.threadId === threadId)
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) as Message[];
    
    return messages;
  }

  async getMessagesByIds(messageIds: string[]): Promise<Message[]> {
    await this.ensureInitialized();
    await this.db.read();
    
    const messages = messageIds
      .map(id => this.db.data.messages[id])
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) as Message[];
    
    return messages;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.ensureInitialized();
    await this.db.read();
    
    if (!this.db.data.messages[messageId]) {
      throw new NotFoundException(`Message with ID '${messageId}' not found`);
    }

    delete this.db.data.messages[messageId];
    this.db.data.metadata.updated_at = new Date().toISOString();
    await this.db.write();
  }

  private async ensureInitialized() {
    if (!this.db) {
      await this.init();
    }
  }
}
