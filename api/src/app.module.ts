import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesModule } from './files/files.module';
import { DocumentationModule } from './documentation/documentation.module';
import { AiModule } from './ai/ai.module';
import { BrandingModule } from './branding/branding.module';
import { GitModule } from './git/git.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FilesModule,
    DocumentationModule,
    AiModule,
    BrandingModule,
    GitModule,
  ],
})
export class AppModule {}
