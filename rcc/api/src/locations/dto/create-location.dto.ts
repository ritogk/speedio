import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsEnum, IsBoolean } from 'class-validator';
import { RoadWidthType } from '../entities/location.entity';
export class CreateLocationDto {
  @ApiProperty({ description: '緯度' })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ description: '経度' })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty({
    description: '路面状況',
    enum: RoadWidthType,
  })
  @IsNotEmpty()
  @IsEnum(RoadWidthType)
  road_width_type: RoadWidthType;

  @ApiProperty({ description: 'ブラインドありを表すフラグ' })
  @IsNotEmpty()
  @IsBoolean()
  isBlind: boolean;
}
