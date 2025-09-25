import { ParserCallbacks, ZazArtifact, ZazAction } from './types/artifact';

export class StreamingMessageParser {
  private buffer = '';
  private currentArtifact: Partial<ZazArtifact> | null = null;
  private currentAction: Partial<ZazAction> | null = null;
  private isInArtifact = false;
  private isInAction = false;
  private actionContent = '';

  constructor(private callbacks: ParserCallbacks = {}) {}

  /**
   * Processa chunk de texto em streaming
   */
  processChunk(chunk: string): void {
    console.log(`🔍 [Parser] Processing chunk:`, JSON.stringify(chunk));
    this.buffer += chunk;
    console.log(`🔍 [Parser] Current buffer:`, JSON.stringify(this.buffer));
    this.parseBuffer();
  }

  /**
   * Finaliza o parsing
   */
  finalize(): void {
    // Se ainda há uma ação aberta, feche-a
    if (this.currentAction && this.isInAction) {
      this.closeCurrentAction();
    }

    // Se ainda há um artifact aberto, feche-o
    if (this.currentArtifact && this.isInArtifact) {
      this.closeCurrentArtifact();
    }

    // Limpar estado
    this.reset();
  }

  /**
   * Reseta o estado do parser
   */
  reset(): void {
    this.buffer = '';
    this.currentArtifact = null;
    this.currentAction = null;
    this.isInArtifact = false;
    this.isInAction = false;
    this.actionContent = '';
  }

  private parseBuffer(): void {
    let lastProcessedIndex = 0;

    // Procurar por tags de abertura e fechamento
    const artifactOpenRegex = /<zazArtifact\s+([^>]*)>/g;
    const artifactCloseRegex = /<\/zazArtifact>/g;
    const actionOpenRegex = /<zazAction\s+([^>]*)>/g;
    const actionCloseRegex = /<\/zazAction>/g;

    // Processar todas as matches na ordem que aparecem
    const matches: Array<{
      type: 'artifactOpen' | 'artifactClose' | 'actionOpen' | 'actionClose';
      index: number;
      attributes?: string;
    }> = [];

    let match;

    // Artifact open tags
    while ((match = artifactOpenRegex.exec(this.buffer)) !== null) {
      matches.push({
        type: 'artifactOpen',
        index: match.index,
        attributes: match[1]
      });
    }

    // Artifact close tags
    while ((match = artifactCloseRegex.exec(this.buffer)) !== null) {
      matches.push({
        type: 'artifactClose',
        index: match.index
      });
    }

    // Action open tags
    while ((match = actionOpenRegex.exec(this.buffer)) !== null) {
      matches.push({
        type: 'actionOpen',
        index: match.index,
        attributes: match[1]
      });
    }

    // Action close tags
    while ((match = actionCloseRegex.exec(this.buffer)) !== null) {
      matches.push({
        type: 'actionClose',
        index: match.index
      });
    }

    // Ordenar matches por posição
    matches.sort((a, b) => a.index - b.index);

    // Processar matches em ordem
    for (const match of matches) {
      // Se estamos em uma ação, enviar conteúdo antes desta tag
      if (this.isInAction && match.index > lastProcessedIndex) {
        const content = this.buffer.slice(lastProcessedIndex, match.index);
        this.actionContent += content;
        this.streamActionContent(content);
      }

      console.log(`🏷️ [Parser] Found tag:`, match.type, 'at position', match.index);
      
      switch (match.type) {
        case 'artifactOpen':
          console.log(`🎯 [Parser] Opening artifact with attributes:`, match.attributes);
          this.openArtifact(match.attributes!);
          break;
        case 'artifactClose':
          console.log(`🎯 [Parser] Closing artifact`);
          this.closeCurrentArtifact();
          break;
        case 'actionOpen':
          console.log(`🎯 [Parser] Opening action with attributes:`, match.attributes);
          this.openAction(match.attributes!);
          break;
        case 'actionClose':
          console.log(`🎯 [Parser] Closing action`);
          this.closeCurrentAction();
          break;
      }

      lastProcessedIndex = match.index + this.getTagLength(match.type);
    }

    // Se estamos em uma ação e há conteúdo restante no buffer
    if (this.isInAction && lastProcessedIndex < this.buffer.length) {
      const content = this.buffer.slice(lastProcessedIndex);
      this.actionContent += content;
      this.streamActionContent(content);
    }

    // Manter apenas o conteúdo não processado no buffer
    this.buffer = this.buffer.slice(lastProcessedIndex);
  }

  private getTagLength(type: string): number {
    switch (type) {
      case 'artifactOpen': return this.buffer.indexOf('>', this.buffer.indexOf('<zazArtifact')) + 1;
      case 'artifactClose': return '</zazArtifact>'.length;
      case 'actionOpen': return this.buffer.indexOf('>', this.buffer.indexOf('<zazAction')) + 1;
      case 'actionClose': return '</zazAction>'.length;
      default: return 0;
    }
  }

  private openArtifact(attributes: string): void {
    const parsedAttributes = this.parseAttributes(attributes);
    
    this.currentArtifact = {
      id: parsedAttributes.id || this.generateId(),
      title: parsedAttributes.title || 'Untitled Artifact',
      type: parsedAttributes.type as any || 'documentation',
      status: 'pending',
      actions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.isInArtifact = true;
    this.callbacks.onArtifactOpen?.(this.currentArtifact);
  }

  private closeCurrentArtifact(): void {
    if (this.currentArtifact && this.isInArtifact) {
      this.currentArtifact.status = 'complete';
      this.currentArtifact.updatedAt = new Date();
      this.callbacks.onArtifactClose?.(this.currentArtifact);
    }

    this.currentArtifact = null;
    this.isInArtifact = false;
  }

  private openAction(attributes: string): void {
    console.log('🔍 [Parser] Opening action with attributes:', attributes);
    const parsedAttributes = this.parseAttributes(attributes);
    console.log('🔍 [Parser] Parsed attributes:', parsedAttributes);
    
    // Parse context safely
    let context: any = undefined;
    if (parsedAttributes.context) {
      console.log('🔍 [Parser] Attempting to parse context:', parsedAttributes.context);
      try {
        context = JSON.parse(parsedAttributes.context);
        console.log('✅ [Parser] Context parsed successfully:', context);
      } catch (error) {
        console.warn('⚠️ [Parser] Failed to parse action context as JSON:', parsedAttributes.context, error.message);
        // Se não for JSON válido, usar como string
        context = { raw: parsedAttributes.context };
      }
    }
    
    this.currentAction = {
      id: parsedAttributes.id || this.generateId(),
      type: parsedAttributes.type as any || 'editDocumentation',
      status: 'running',
      content: '',
      context,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.isInAction = true;
    this.actionContent = '';
    this.callbacks.onActionOpen?.(this.currentAction);
  }

  private closeCurrentAction(): void {
    if (this.currentAction && this.isInAction) {
      this.currentAction.content = this.actionContent.trim();
      this.currentAction.status = 'complete';
      this.currentAction.updatedAt = new Date();
      this.callbacks.onActionClose?.(this.currentAction);

      // Adicionar ação ao artifact atual
      if (this.currentArtifact) {
        this.currentArtifact.actions = this.currentArtifact.actions || [];
        this.currentArtifact.actions.push(this.currentAction as ZazAction);
      }
    }

    this.currentAction = null;
    this.isInAction = false;
    this.actionContent = '';
  }

  private streamActionContent(content: string): void {
    if (this.currentAction) {
      this.callbacks.onActionStream?.(this.currentAction, content);
    }
  }

  private parseAttributes(attributeString: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    
    // Regex mais robusta para capturar atributos, incluindo JSON com aspas internas
    const regex = /(\w+)=(["'])((?:(?!\2)[^\\]|\\.)*)(\2)/g;
    let match;

    while ((match = regex.exec(attributeString)) !== null) {
      const key = match[1];
      const value = match[3]; // Valor sem as aspas externas
      attributes[key] = value;
    }

    // Fallback: se não encontrou nada, tentar parsing mais simples
    if (Object.keys(attributes).length === 0) {
      const simpleRegex = /(\w+)=["']([^"']*)["']/g;
      while ((match = simpleRegex.exec(attributeString)) !== null) {
        attributes[match[1]] = match[2];
      }
    }

    return attributes;
  }

  private generateId(): string {
    return `zaz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
