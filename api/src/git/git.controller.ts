import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { GitService } from './git.service';

@Controller('git')
export class GitController {
  constructor(private readonly gitService: GitService) {}

  @Get('unsaved-diffs')
  async getUnsavedDiffs(
    @Query('namespace') namespace: string,
    @Query('app') app: string,
    @Query('verbose') verbose?: string,
  ) {
    return this.gitService.getUnsavedDiffs({ namespace, app, verbose: verbose === 'true' });
  }

  @Post('apply-diffs')
  async applyDiffs(
    @Body() body: { namespace: string; app: string; files?: Array<{ osPath?: string; appPath?: string }> }
  ) {
    const { namespace, app, files } = body || {} as any;
    return this.gitService.applyUnsavedDiffs({ namespace, app, files });
  }
}


