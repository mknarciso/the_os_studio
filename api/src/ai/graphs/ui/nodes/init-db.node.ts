import { Injectable, Logger } from '@nestjs/common';
import { FileSystemToolService } from '../../../tools/file-system.tool';
import { UiState } from '../ui.state';

@Injectable()
export class InitDbNode {
  private readonly logger = new Logger(InitDbNode.name);
  constructor(private readonly fsTool: FileSystemToolService) {}

  async execute(state: typeof UiState.State) {
    const { customer, namespace, app } = state.input;
    this.logger.log(`init_db: ensuring ui.json for ${customer}/${namespace}/${app}`);
    const p = this.fsTool.getUiJsonPath(customer, namespace, app);
    await this.fsTool.ensureUiDbFile(p);
    const db = await this.fsTool.loadUiDb(p);
    this.logger.log(`init_db: ui.json ready at ${p}`);
    return { result: { path: p, db } };
  }
}


