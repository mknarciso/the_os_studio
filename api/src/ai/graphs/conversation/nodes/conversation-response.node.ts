import { Injectable, Logger } from '@nestjs/common';
import { ConversationService } from '../../../services/conversation.service';
import { ConversationState } from '../conversation.state';

@Injectable()
export class ConversationResponseNode {
  private readonly logger = new Logger(ConversationResponseNode.name);

  constructor(
    private readonly conversationService: ConversationService,
  ) {}

  async execute(state: typeof ConversationState.State) {
    this.logger.log('Generating conversational response');
    
    const contextWithDoc = state.type === 'documentation' && state.currentDocContext?.hasDocumentation
      ? { ...state.context, currentDocumentation: state.currentDocContext }
      : state.context;

    const aiResponse = await this.conversationService.generateResponse(
      state.inputMessage,
      state.type,
      contextWithDoc
    );
    
    this.logger.log(`Generated response of length: ${aiResponse.length}`);
    return { aiResponse };
  }
}

