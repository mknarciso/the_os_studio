import { Injectable, Logger } from '@nestjs/common';
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { UiState, UiInput } from './ui.state';
import { InitDbNode } from './nodes/init-db.node';
import { UpdateFromFileNode } from './nodes/update-from-file.node';
import { ListAllNode } from './nodes/list-all.node';
import { FileSystemToolService } from '../../tools/file-system.tool';
import { JsonPatchTool } from '../../tools/json-patch.tool';
import { UiAnalyzerService } from '../../tools/ui-analyzer.service';
import type { Operation } from 'fast-json-patch';
import * as fs from 'fs/promises';
import * as path from 'path';

export const UI_GRAPH_VERSION = '1.0.0';

@Injectable()
export class UiGraph {
  private compiled?: any;
  private readonly logger = new Logger(UiGraph.name);
  constructor(
    private readonly initDb: InitDbNode,
    private readonly updateFromFile: UpdateFromFileNode,
    private readonly listAll: ListAllNode,
    private readonly fsTool: FileSystemToolService,
    private readonly patch: JsonPatchTool,
    private readonly analyzer: UiAnalyzerService,
  ) {}

  private State = UiState;

  private async compile() {
    if (this.compiled) return this.compiled;
    this.logger.log(`Compiling UI graph (version ${UI_GRAPH_VERSION})`);
    const b = new StateGraph(this.State);

    const updateAll = async (state: typeof this.State.State) => {
      this.logger.log(`Node(update_all): start for ${state.input.namespace}/${state.input.app}`);
      const { namespace, app } = state.input;
      const { pages, components, flowRoot } = await this.fsTool.listAllUiFiles({ namespace, app });
      this.logger.log(`Node(update_all): discovered pages=${pages.length}, components=${components.length}`);
      const targetPath = this.fsTool.getUiJsonPath(namespace, app);
      const results: Array<{ key: string; kind: 'page' | 'component' }> = [];

      for (const filePath of [...pages, ...components]) {
        this.logger.log(`Node(update_all): processing ${filePath}`);
        
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const relPath = path.relative(flowRoot, filePath).replace(/\\/g, '/');
        const kind = (relPath.startsWith('pages/') || relPath.includes('/pages/')) ? 'page' : 'component';
        const name = path.basename(filePath, path.extname(filePath));

        const llmResult = await this.analyzer.analyze(fileContent, kind);
        
        const finalObject = { name, file_path: relPath, ...llmResult };
        
        const patchPath = `/${kind}s/${name}`;
        const ops: Operation[] = [{ op: 'add', path: patchPath, value: finalObject }];
        await this.patch.applyPatchToFile({ filePath: targetPath, patch: ops, validate: false });
        results.push({ key: name, kind });
      }
      this.logger.log(`Node(update_all): wrote ${results.length} entries into ${targetPath}`);
      return { result: { updated: results.length, items: results, targetPath } };
    };

    this.compiled = b
      .addNode('init_db', (s) => this.initDb.execute(s))
      .addNode('update_from_file', (s) => this.updateFromFile.execute(s))
      .addNode('list_all', (s) => this.listAll.execute(s))
      .addNode('update_all', updateAll)
      .addEdge(START, 'init_db')
      .addConditionalEdges('init_db', async (s: any) => {
        const a = s.input.action as UiInput['action'];
        if (a === 'init_db') return 'END';
        if (a === 'update_from_file') return 'update_from_file';
        if (a === 'list_all') return 'list_all';
        return 'update_all';
      })
      .addEdge('update_from_file', END)
      .addEdge('list_all', END)
      .addEdge('update_all', END)
      .compile();
    this.logger.log(`UI graph compiled.`);

    return this.compiled;
  }

  async run(input: UiInput): Promise<any> {
    this.logger.log(`Run(action=${input.action}) for ${input.namespace}/${input.app}`);
    const g = await this.compile();
    const out = await g.invoke({ input });
    const updated = out?.result?.updated ?? 0;
    const targetPath = out?.result?.targetPath;
    if (updated || targetPath) this.logger.log(`Run(action=${input.action}) result: updated=${updated} target=${targetPath || 'n/a'}`);
    return out?.result;
  }
}


