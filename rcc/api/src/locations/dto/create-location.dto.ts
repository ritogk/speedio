import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import { RoadCondition } from '../entities/location.entity';
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
    enum: RoadCondition,
  })
  @IsNotEmpty()
  @IsEnum(RoadCondition)
  roadCondition: RoadCondition;
}
