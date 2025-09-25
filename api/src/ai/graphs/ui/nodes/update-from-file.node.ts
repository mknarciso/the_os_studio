import { Injectable, Logger } from '@nestjs/common';
import { FileSystemToolService } from '../../../tools/file-system.tool';
import { JsonPatchTool } from '../../../tools/json-patch.tool';
import { UiState } from '../ui.state';
import type { Operation } from 'fast-json-patch';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UiAnalyzerService } from '../../../tools/ui-analyzer.service';

@Injectable()
export class UpdateFromFileNode {
  private readonly logger = new Logger(UpdateFromFileNode.name);
  constructor(
    private readonly fsTool: FileSystemToolService,
    private readonly patch: JsonPatchTool,
    private readonly analyzer: UiAnalyzerService,
  ) {}

  async execute(state: typeof UiState.State) {
    const { customer, namespace, app, filePath } = state.input;
    if (!filePath) throw new Error('filePath is required for update_from_file');
    this.logger.log(`Executing: update from file ${filePath}`);

    const { flowRoot } = await this.fsTool.resolveRoots(customer, namespace, app);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const relPath = path.relative(flowRoot, filePath).replace(/\\/g, '/');
    const kind = (relPath.startsWith('pages/') || relPath.includes('/pages/')) ? 'page' : 'component';
    const name = path.basename(filePath, path.extname(filePath));

    // 1. Analyze with LLM
    const llmResult = await this.analyzer.analyze(fileContent, kind);

    // 2. Construct final object
    const finalObject = {
      name,
      file_path: relPath,
      ...llmResult,
    };

    // 3. Apply patch
    const targetJson = this.fsTool.getUiJsonPath(customer, namespace, app);
    const patchPath = `/${kind}s/${name}`;
    const patchOp: Operation = { op: 'add', path: patchPath, value: finalObject };
    
    // Ensure parent object exists
    const db = await this.fsTool.loadUiDb(targetJson);
    if (!db[`${kind}s`]) {
      await this.patch.applyPatchToFile({ filePath: targetJson, patch: [{ op: 'add', path: `/${kind}s`, value: {} }] });
    }
    
    await this.patch.applyPatchToFile({ filePath: targetJson, patch: [patchOp] });

    this.logger.log(`Patched ${patchPath} in ${targetJson}`);
    return { result: { updated: kind, key: name, targetPath: targetJson } };
  }
}


