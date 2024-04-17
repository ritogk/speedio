import { ApiProperty } from '@nestjs/swagger';
import { RoadCondition } from '../entities/location.entity';
export class LocationDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  latitude: string;

  @ApiProperty()
  longitude: number;

  @ApiProperty()
  roadCondition: RoadCondition;
}
