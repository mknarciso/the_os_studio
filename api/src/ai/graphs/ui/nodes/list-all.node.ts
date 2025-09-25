import { Injectable, Logger } from '@nestjs/common';
import { FileSystemToolService } from '../../../tools/file-system.tool';
import { UiState } from '../ui.state';

@Injectable()
export class ListAllNode {
  private readonly logger = new Logger(ListAllNode.name);
  constructor(private readonly fsTool: FileSystemToolService) {}

  async execute(state: typeof UiState.State) {
    const { customer, namespace, app } = state.input;
    this.logger.log(`list_all: scanning ${customer}/${namespace}/${app}`);
    const res = await this.fsTool.listAllUiFiles({ customer, namespace, app });
    this.logger.log(`list_all: found pages=${res.pages.length} components=${res.components.length}`);
    return { result: res };
  }
}


