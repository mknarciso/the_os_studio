import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { DocumentationService } from './documentation.service';

@Controller('documentation')
export class DocumentationController {
  constructor(private readonly documentationService: DocumentationService) {}

  @Get()
  async getAll(
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.getAll({ namespace, app });
  }

  @Get('app')
  async getApp(
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.getApp({ namespace, app });
  }

  @Put('app')
  async updateApp(
    @Body() data: any,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.updateApp({ namespace, app }, data);
  }

  // Generic entity endpoints
  @Get(':entityType')
  async getEntity(
    @Param('entityType') entityType: string,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.getEntity({ namespace, app }, entityType);
  }

  @Post(':entityType')
  async createEntity(
    @Param('entityType') entityType: string,
    @Body() data: any,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.createEntity({ namespace, app }, entityType, data);
  }

  @Put(':entityType/:slug')
  async updateEntity(
    @Param('entityType') entityType: string,
    @Param('slug') slug: string,
    @Body() data: any,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.updateEntity({ namespace, app }, entityType, slug, data);
  }

  @Delete(':entityType/:slug')
  async deleteEntity(
    @Param('entityType') entityType: string,
    @Param('slug') slug: string,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.deleteEntity({ namespace, app }, entityType, slug);
  }
}

