import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { DocumentationService } from './documentation.service';

@Controller('documentation')
export class DocumentationController {
  constructor(private readonly documentationService: DocumentationService) {}

  @Get()
  async getAll(
    @Query('customer') customer?: string,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.getAll({ customer, namespace, app });
  }

  @Get('app')
  async getApp(
    @Query('customer') customer?: string,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.getApp({ customer, namespace, app });
  }

  @Put('app')
  async updateApp(
    @Body() data: any,
    @Query('customer') customer?: string,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.updateApp({ customer, namespace, app }, data);
  }

  // Generic entity endpoints
  @Get(':entityType')
  async getEntity(
    @Param('entityType') entityType: string,
    @Query('customer') customer?: string,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.getEntity({ customer, namespace, app }, entityType);
  }

  @Post(':entityType')
  async createEntity(
    @Param('entityType') entityType: string,
    @Body() data: any,
    @Query('customer') customer?: string,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.createEntity({ customer, namespace, app }, entityType, data);
  }

  @Put(':entityType/:slug')
  async updateEntity(
    @Param('entityType') entityType: string,
    @Param('slug') slug: string,
    @Body() data: any,
    @Query('customer') customer?: string,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.updateEntity({ customer, namespace, app }, entityType, slug, data);
  }

  @Delete(':entityType/:slug')
  async deleteEntity(
    @Param('entityType') entityType: string,
    @Param('slug') slug: string,
    @Query('customer') customer?: string,
    @Query('namespace') namespace?: string,
    @Query('app') app?: string,
  ) {
    return this.documentationService.deleteEntity({ customer, namespace, app }, entityType, slug);
  }
}

