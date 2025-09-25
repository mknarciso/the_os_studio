import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { ConversationState, ConversationInput, ConversationOutput } from './conversation.state';
import { LoadContextNode } from './nodes/load-context.node';
import { AnalyzeIntentionNode } from './nodes/analyze-intention.node';
import { DocumentationToolNode } from './nodes/documentation-tool.node';
import { ConversationResponseNode } from './nodes/conversation-response.node';
import { ConversationService } from '../../services/conversation.service';
import { IntentionAnalysis } from '../../services/intention-analyzer.service';

export const CONVERSATION_GRAPH_VERSION = '1.0.0';

@Injectable()
export class ConversationGraph {
  private compiled?: any;
  private cachedNodes?: string[];
  private cachedEdges?: { from: string; to: string }[];
  private readonly logger = new Logger(ConversationGraph.name);

  constructor(
    private readonly loadContext: LoadContextNode,
    private readonly analyzeIntention: AnalyzeIntentionNode,
    private readonly documentationTool: DocumentationToolNode,
    private readonly conversationResponse: ConversationResponseNode,
    private readonly conversationService: ConversationService,
  ) {}

  private async compile() {
    if (this.compiled) return this.compiled;
    
    this.logger.log(`Compiling conversation graph (version ${CONVERSATION_GRAPH_VERSION})`);
    
    const builder = new StateGraph(ConversationState);

    this.compiled = builder
      .addNode('load_context', (state) => this.loadContext.execute(state))
      .addNode('analyze_intention', (state) => this.analyzeIntention.execute(state))
      .addNode('documentation_tool', (state) => this.documentationTool.execute(state))
      .addNode('conversation_response', (state) => this.conversationResponse.execute(state))
      .addEdge(START, 'load_context')
      .addEdge('load_context', 'analyze_intention')
      .addConditionalEdges('analyze_intention', async (state: typeof ConversationState.State) => {
        const intention: IntentionAnalysis | undefined = (state as any).intention;
        if (intention && intention.suggestedAction === 'documentation_tool' && intention.confidence > 0.6) {
          this.logger.log('Routing to documentation_tool based on intention analysis');
          return 'documentation_tool';
        }
        this.logger.log('Routing to conversation_response');
        return 'conversation_response';
      })
      .addEdge('documentation_tool', END)
      .addEdge('conversation_response', END)
      .compile();

    // Cache nodes and edges for visualization
    try {
      const edgesSet: any = this.compiled?.builder?.allEdges;
      const edgesArray: Array<[string, string]> = Array.isArray(edgesSet)
        ? edgesSet
        : edgesSet instanceof Set
          ? Array.from(edgesSet)
          : [];

      const normalize = (key: string) => {
        if (key === '__start__') return 'START';
        if (key === '__end__') return 'END';
        return key;
      };

      const edges = edgesArray.map(([from, to]) => ({ from: normalize(from), to: normalize(to) }));
      const nodeSet = new Set<string>();
      edges.forEach(e => { nodeSet.add(e.from); nodeSet.add(e.to); });
      this.cachedEdges = edges;
      this.cachedNodes = Array.from(nodeSet);
    } catch {
      this.cachedNodes = undefined;
      this.cachedEdges = undefined;
    }

    this.logger.log('Conversation graph compiled successfully');
    return this.compiled;
  }

  async run(input: ConversationInput): Promise<ConversationOutput> {
    this.logger.log(`Running conversation graph for message: "${input.message.slice(0, 50)}..."`);
    
    const graph = await this.compile();
    const result: any = await graph.invoke({
      inputMessage: input.message,
      type: input.type,
      context: input.context || {},
    });

    this.logger.log('Conversation graph execution completed');
    return {
      aiResponse: String(result?.aiResponse ?? ''),
      intention: (result?.intention as IntentionAnalysis | undefined),
    };
  }

  async stream(input: ConversationInput): Promise<AsyncIterable<string>> {
    this.logger.log(`Streaming conversation for message: "${input.message.slice(0, 50)}..."`);
    
    // Stream only the conversation path for now; when documentation_tool triggers,
    // we fallback to non-stream generation (it returns a single payload)
    const graph = await this.compile();
    const result: any = await graph.invoke({
      inputMessage: input.message,
      type: input.type,
      context: input.context || {},
    });

    const intention: IntentionAnalysis | undefined = result?.intention;
    if (intention && intention.suggestedAction === 'documentation_tool' && intention.confidence > 0.6) {
      // Non-stream path
      this.logger.log('Using non-stream path for documentation tool');
      const nonStream = await this.run(input);
      async function* oneShot() { yield nonStream.aiResponse; }
      return oneShot();
    }

    const contextWithDoc = input.type === 'documentation' && result?.currentDocContext?.hasDocumentation
      ? { ...(input.context || {}), currentDocumentation: result.currentDocContext }
      : input.context;

    this.logger.log('Using stream path for conversation response');
    return this.conversationService.streamResponse(
      input.message,
      input.type,
      contextWithDoc
    );
  }

  async getGraphInfo(): Promise<{ nodes: string[]; edges: { from: string; to: string }[] }> {
    await this.compile();
    const nodes = this.cachedNodes || [];
    const edges = this.cachedEdges || [];

    if (nodes.length === 0 || edges.length === 0) {
      return {
        nodes: ['START', 'load_context', 'analyze_intention', 'documentation_tool', 'conversation_response', 'END'],
        edges: [
          { from: 'START', to: 'load_context' },
          { from: 'load_context', to: 'analyze_intention' },
          { from: 'analyze_intention', to: 'documentation_tool' },
          { from: 'analyze_intention', to: 'conversation_response' },
          { from: 'documentation_tool', to: 'END' },
          { from: 'conversation_response', to: 'END' },
        ],
      };
    }

    return { nodes, edges };
  }

  async getMermaid(): Promise<string> {
    const { nodes, edges } = await this.getGraphInfo();
    const lines: string[] = [];
    lines.push('graph TD');
    // declare nodes
    nodes.forEach(n => {
      if (n === 'START') lines.push('  start((Start))');
      else if (n === 'END') lines.push('  end_node((End))');
      else lines.push(`  ${n}[${n}]`);
    });
    // edges
    edges.forEach(e => {
      const from = e.from === 'START' ? 'start' : e.from === 'END' ? 'end_node' : e.from;
      const to = e.to === 'START' ? 'start' : e.to === 'END' ? 'end_node' : e.to;
      lines.push(`  ${from} --> ${to}`);
    });
    return lines.join('\n');
  }
}

