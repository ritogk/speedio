import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Point,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum RoadCondition {
  TWO_LANE_SHOULDER = 'TWO_LANE_SHOULDER', // ２車線かつ路肩あり
  TWO_LANE = 'TWO_LANE', // 2車線かつ路肩なし
  ONE_LANE_SPACIOUS = 'ONE_LANE_SPACIOUS', // 1車線かつ2台が余裕を持って通行できる
  ONE_LANE = 'ONE_LANE', // 1車線かつ1台のみ通行可能
  UNCONFIRMED = 'UNCONFIRMED', // 未確認
}

@Entity({ name: 'locations' })
export class Location {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'id' })
  id: number;

  @Column({
    type: 'decimal',
    precision: 13,
    scale: 10,
  })
  @ApiProperty({ description: '緯度' })
  latitude: number;

  @Column({
    type: 'decimal',
    precision: 13,
    scale: 10,
  })
  @ApiProperty({ description: '経度' })
  longitude: number;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4612,
  })
  geometry: Point;

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

  @CreateDateColumn()
  @ApiProperty({ description: '作成日時' })
  created_at: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: '更新日時' })
  updated_at: Date;
}
