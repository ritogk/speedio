import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
export class CreateItemDto {
  @ApiProperty({ description: 'テキスト' })
  @IsString()
  @IsNotEmpty()
  text: string;
}
