import { Controller, Post, Get, Body, Param, Query, ValidationPipe } from '@nestjs/common';
import { FilesService } from './files.service';
import { SaveFileDto } from './dto/save-file.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('save')
  async saveFile(@Body(ValidationPipe) saveFileDto: SaveFileDto) {
    return this.filesService.saveFile(saveFileDto);
  }

  @Get('tree/:customer/:namespace/:app')
  async getFileTree(
    @Param('customer') customer: string,
    @Param('namespace') namespace: string,
    @Param('app') app: string,
    @Query('subPath') subPath?: string,
  ) {
    return this.filesService.getFileTree(customer, namespace, app, subPath);
  }

  @Get('content/:customer/:namespace/:app')
  async getFileContent(
    @Param('customer') customer: string,
    @Param('namespace') namespace: string,
    @Param('app') app: string,
    @Query('path') relativePath: string,
  ) {
    return this.filesService.getFileContent(customer, namespace, app, relativePath);
  }
}
