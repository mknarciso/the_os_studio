import { Injectable, Logger } from '@nestjs/common';
import { IntentionAnalyzerService } from '../../../services/intention-analyzer.service';
import { ConversationState } from '../conversation.state';

@Injectable()
export class AnalyzeIntentionNode {
  private readonly logger = new Logger(AnalyzeIntentionNode.name);

  constructor(
    private readonly intentionAnalyzer: IntentionAnalyzerService,
  ) {}

  async execute(state: typeof ConversationState.State) {
    this.logger.log(`Analyzing intention for message: "${state.inputMessage.slice(0, 50)}..."`);
    
    const intention = await this.intentionAnalyzer.analyzeIntention(
      state.inputMessage,
      state.type,
      state.context
    );
    
    this.logger.log(`Intention analyzed: ${intention.suggestedAction} (confidence: ${intention.confidence})`);
    return { intention };
  }
}

