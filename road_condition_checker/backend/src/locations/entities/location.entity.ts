import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

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

  @Column({ default: true })
  @ApiProperty({ description: '路面状況' })
  roadCondition: RoadCondition;
}

export type RoadCondition =
  | 'COMFORTABLE' // 快適に走れる道
  | 'PASSABLE' // 狭い所もある程度は走れる道
  | 'UNPLEASANT' // 狭くて走りたくない道
  | 'UNCONFIRMED'; // 未確認
