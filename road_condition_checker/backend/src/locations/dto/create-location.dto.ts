import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { RoadCondition } from '../entities/location.entity';
export class CreateLocationDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  roadCondition: RoadCondition;
}
