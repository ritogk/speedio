import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsEnum, IsBoolean, IsOptional } from 'class-validator';
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

  @ApiProperty({ description: 'センターラインの有無' })
  @IsBoolean()
  has_center_line: boolean;

  @ApiProperty({ description: '走行ラインの自由度があるか', required: false })
  @IsBoolean()
  @IsOptional()
  line_clearance?: boolean;
}
