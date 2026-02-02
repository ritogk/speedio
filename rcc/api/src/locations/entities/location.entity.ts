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

export enum RoadWidthType {
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
    srid: 4326,
  })
  @Index({ spatial: true })
  @ApiProperty({ description: 'ポイント' })
  point: Point;

  @Column({
    type: 'enum',
    enum: RoadWidthType,
    default: RoadWidthType.UNCONFIRMED,
  })
  @ApiProperty({
    description: '路面状況',
    enum: RoadWidthType,
  })
  road_width_type: RoadWidthType;

  @Column({
    type: 'enum',
    enum: RoadWidthType,
    default: RoadWidthType.UNCONFIRMED,
  })
  @ApiProperty({
    description: '路面状況(Claudeの推定)',
    enum: RoadWidthType,
  })
  claude_road_width_type: RoadWidthType;

  @Column({
    type: 'boolean',
    nullable: true,
  })
  @ApiProperty({
    description: 'センターラインの有無を表すフラグ',
  })
  has_center_line?: boolean;

  @Column({
    type: 'int',
    nullable: true,
  })
  @ApiProperty({
    description: '車線数(Claudeの推定)',
  })
  claude_lanes?: number;

  @Column({
    type: 'float',
    nullable: true,
  })
  @ApiProperty({
    description: '車線幅(Claudeの推定)',
  })
  claude_lane_width?: number;

  @Column({
    type: 'boolean',
    nullable: true,
  })
  @ApiProperty({
    description: 'センターラインの有無(Claudeの推定)',
  })
  claude_center_line?: boolean;

  @Column({
    type: 'float',
    nullable: true,
  })
  @ApiProperty({
    description: '左路肩幅(Claudeの推定)',
  })
  claude_shoulder_left?: number;

  @Column({
    type: 'float',
    nullable: true,
  })
  @ApiProperty({
    description: '右路肩幅(Claudeの推定)',
  })
  claude_shoulder_right?: number;

  @Column({
    type: 'boolean',
    nullable: true,
  })
  @ApiProperty({
    description: '左ガードレールの有無(Claudeの推定)',
  })
  claude_guardrail_left?: boolean;

  @Column({
    type: 'boolean',
    nullable: true,
  })
  @ApiProperty({
    description: '右ガードレールの有無(Claudeの推定)',
  })
  claude_guardrail_right?: boolean;

  @Column({
    type: 'boolean',
    nullable: true,
  })
  @ApiProperty({
    description: 'トンネル内かどうか(Claudeの推定)',
  })
  claude_is_tunnel?: boolean;

  @CreateDateColumn()
  @ApiProperty({ description: '作成日時' })
  created_at: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: '更新日時' })
  updated_at: Date;
}
