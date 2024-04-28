import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Point,
  Index,
  Unique,
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
@Unique(['point'])
export class Location {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'id' })
  id: number;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4612,
  })
  @Index({ spatial: true })
  @ApiProperty({ description: 'ポイント' })
  point: Point;

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

  @Column({
    type: 'boolean',
    default: false,
  })
  @ApiProperty({
    description: '見通しが悪い事を表すフラグ',
  })
  isBlind: boolean;

  @CreateDateColumn()
  @ApiProperty({ description: '作成日時' })
  created_at: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: '更新日時' })
  updated_at: Date;
}
