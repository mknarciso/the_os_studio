import { Controller, Get, Param, Query, Post, Body, BadRequestException } from '@nestjs/common';
import { BrandingService } from './branding.service';
import { mastra } from '../mastra';

@Controller('branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get('content/:customer')
  async getContent(
    @Param('customer') customer: string,
    @Query('path') relPath: string,
  ) {
    if (!relPath) throw new BadRequestException('Missing path');
    return this.brandingService.readBrandingFile(customer, relPath);
  }

  @Post('run')
  async runBranding(@Body() body: any) {
    const { customer, domain } = body || {};
    if (!customer || !domain) throw new BadRequestException('Missing customer or domain');
    return this.brandingService.runBrandingWorkflow({ customer, domain });
  }

  @Post('test')
  async runTest(@Body() body: any) {
    const { name = 'world' } = body || {};
    
    // Debug: Log environment and telemetry info
    console.log('=== NestJS Branding Controller Test Debug ===');
    console.log('globalThis.___MASTRA_TELEMETRY___:', globalThis.___MASTRA_TELEMETRY___);
    console.log('MASTRA_STORAGE_URL:', process.env.MASTRA_STORAGE_URL);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('Mastra telemetry:', mastra.getTelemetry());
    console.log('Mastra storage:', mastra.getStorage());
    console.log('============================================');
    
    const wf = mastra.getWorkflow('helloWorldWorkflow');
    const run = await wf.createRunAsync();
    const result: any = await run.start({ inputData: { name } });
    return result?.output || result;
  }
}


