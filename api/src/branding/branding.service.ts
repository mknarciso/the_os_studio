import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { mastra } from '../mastra';

@Injectable()
export class BrandingService {
  private readonly customersBase = path.join(__dirname, '..', '..', '..', '..', 'customers');

  private getCustomerBrandingDir(customer: string) {
    return path.join(this.customersBase, customer, 'branding');
  }

  async readBrandingFile(customer: string, relPath: string) {
    const base = this.getCustomerBrandingDir(customer);
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

  async runBrandingWorkflow({ customer, domain }: { customer: string; domain: string }) {
    const targetDir = this.getCustomerBrandingDir(customer);
    
    // Debug: Log environment and telemetry info
    console.log('=== NestJS Branding Service Debug ===');
    console.log('MASTRA_STORAGE_URL:', process.env.MASTRA_STORAGE_URL);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('Mastra telemetry:', mastra.getTelemetry());
    console.log('Mastra storage:', mastra.getStorage());
    console.log('=====================================');
    
    try {
      const wf = mastra.getWorkflow('brandDesignerWorkflow');
      const run = await wf.createRunAsync();
      await run.start({ inputData: { domain, targetDir } });

      const guidelinePath = path.join(targetDir, 'guideline.yaml');
      const cssPath = path.join(targetDir, 'index.css');
      return { success: true, customer, paths: { guidelinePath, cssPath } };
    } catch (e) {
      throw new InternalServerErrorException('Failed to run branding workflow');
    }
  }
}


