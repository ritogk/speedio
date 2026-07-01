import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { RoadWidthType, LaneWidth, RoadMargin } from '../entities/location.entity';
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

  @ApiProperty({ description: '車線幅', enum: LaneWidth, required: false })
  @IsEnum(LaneWidth)
  @IsOptional()
  lane_width?: LaneWidth;

  @ApiProperty({ description: '路側の余裕', enum: RoadMargin, required: false })
  @IsEnum(RoadMargin)
  @IsOptional()
  road_margin?: RoadMargin;
}
