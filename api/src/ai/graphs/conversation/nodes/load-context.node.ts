import { Injectable, Logger } from '@nestjs/common';
import { DocumentationLoaderService } from '../../../services/documentation-loader.service';
import { ConversationState } from '../conversation.state';

@Injectable()
export class LoadContextNode {
  private readonly logger = new Logger(LoadContextNode.name);

  constructor(
    private readonly documentationLoader: DocumentationLoaderService,
  ) {}

  async execute(state: typeof ConversationState.State) {
    this.logger.log(`Loading context for type: ${state.type}`);
    
    if (state.type === 'documentation') {
      const ctx = await this.documentationLoader.loadCurrentDocumentation(state.context);
      this.logger.log(`Documentation context loaded: ${ctx?.hasDocumentation ? 'found' : 'not found'}`);
      return { currentDocContext: ctx };
    }
    
    this.logger.log('No context loading needed for general conversation');
    return {};
  }
}

