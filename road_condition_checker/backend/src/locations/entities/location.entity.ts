import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum RoadCondition {
  COMFORTABLE = 'COMFORTABLE', // 快適に走れる道
  PASSABLE = 'PASSABLE', // 狭い道と快適に走れる道の中間
  UNPLEASANT = 'UNPLEASANT', // 狭くて走りたくない道
  UNCONFIRMED = 'UNCONFIRMED', // 未確認
}

@Entity({ name: 'locations' })
export class Location {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'id' })
  id: number;

  @Column()
  @ApiProperty({ description: '緯度' })
  latitude: number;

  @Column()
  @ApiProperty({ description: '経度' })
  longitude: number;

  @Column({
    type: 'enum',
    enum: RoadCondition,
    default: RoadCondition.UNCONFIRMED,
  })
  @ApiProperty({
    description: '路面状況',
    enum: RoadCondition,
  })
  roadCondition: RoadCondition;
}
