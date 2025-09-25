import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { mastra } from '../mastra';

@Injectable()
export class BrandingService {
  // Workspace root is /
  private readonly workspaceRoot = path.join(__dirname, '..', '..');

  private getWorkspaceBrandingDir() {
    // workspace param kept for API signature, but workspaceRoot already points to the workspace root
    return path.join(this.workspaceRoot, 'branding');
  }

  async readBrandingFile(relPath: string) {
    const base = this.getWorkspaceBrandingDir();
    const target = path.resolve(base, relPath);
    const resolvedBase = path.resolve(base);
    if (!target.startsWith(resolvedBase)) {
      throw new InternalServerErrorException('Invalid path');
    }
    try {
      const content = await fs.readFile(target, 'utf8');
      return { content };
    } catch (e) {
      throw new InternalServerErrorException('Failed to read branding file');
    }
  }

  async runBrandingWorkflow({ domain }: { domain: string }) {
    const targetDir = this.getWorkspaceBrandingDir();
    
    try {
      const wf = mastra.getWorkflow('brandDesignerWorkflow');
      const run = await wf.createRunAsync();
      await run.start({ inputData: { domain, targetDir } });

      const guidelinePath = path.join(targetDir, 'guideline.yaml');
      const cssPath = path.join(targetDir, 'index.css');
      return { success: true, paths: { guidelinePath, cssPath } };
    } catch (e) {
      throw new InternalServerErrorException('Failed to run branding workflow');
    }
  }
}


