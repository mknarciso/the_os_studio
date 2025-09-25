import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ThreadService } from './services/thread.service';
import { MessageService } from './services/message.service';
import { ConversationService } from './services/conversation.service';
import { IntentionAnalyzerService } from './services/intention-analyzer.service';
import { DocumentationToolService } from './services/documentation-tool.service';
import { DocumentationLoaderService } from './services/documentation-loader.service';
import { ConversationGraph } from './graphs/conversation/conversation.graph';
import { LoadContextNode } from './graphs/conversation/nodes/load-context.node';
import { AnalyzeIntentionNode } from './graphs/conversation/nodes/analyze-intention.node';
import { DocumentationToolNode } from './graphs/conversation/nodes/documentation-tool.node';
import { ConversationResponseNode } from './graphs/conversation/nodes/conversation-response.node';
import { FileSystemToolService } from './tools/file-system.tool';
import { UiAnalyzerService } from './tools/ui-analyzer.service';
import { UiGraph } from './graphs/ui/ui.graph';
import { InitDbNode } from './graphs/ui/nodes/init-db.node';
import { UpdateFromFileNode } from './graphs/ui/nodes/update-from-file.node';
import { ListAllNode } from './graphs/ui/nodes/list-all.node';
import { JsonPatchTool } from './tools/json-patch.tool';
import { ActionRunnerService } from './action-runner.service';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    ThreadService,
    MessageService,
    ConversationService,
    IntentionAnalyzerService,
    DocumentationToolService,
    DocumentationLoaderService,
    ConversationGraph,
    LoadContextNode,
    AnalyzeIntentionNode,
    DocumentationToolNode,
    ConversationResponseNode,
    FileSystemToolService,
    UiAnalyzerService,
    UiGraph,
    InitDbNode,
    UpdateFromFileNode,
    ListAllNode,
    JsonPatchTool,
    ActionRunnerService,
  ],
  exports: [AiService],
})
export class AiModule {}
