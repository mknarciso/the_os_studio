import { IsString, IsNotEmpty } from 'class-validator';

export class SaveFileDto {
  @IsString()
  @IsNotEmpty()
  customer: string;

  @IsString()
  @IsNotEmpty()
  namespace: string;

  @IsString()
  @IsNotEmpty()
  app: string;

  @IsString()
  @IsNotEmpty()
  relativePath: string;

  @IsString()
  content: string;
}
