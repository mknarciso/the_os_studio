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

  @Get('tree/:namespace/:app')
  async getFileTree(
    @Param('namespace') namespace: string,
    @Param('app') app: string,
    @Query('subPath') subPath?: string,
  ) {
    return this.filesService.getFileTree(namespace, app, subPath);
  }

  @Get('content/:namespace/:app')
  async getFileContent(
    @Param('namespace') namespace: string,
    @Param('app') app: string,
    @Query('path') relativePath: string,
  ) {
    return this.filesService.getFileContent(namespace, app, relativePath);
  }

  @Get('content-by-os')
  async getFileContentByOsPath(@Query('path') osPath: string) {
    return this.filesService.getFileContentByOsPath(osPath);
  }

  @Get('content-by-app')
  async getFileContentByAppPath(@Query('path') appPath: string) {
    return this.filesService.getFileContentByAppPath(appPath);
  }
}
