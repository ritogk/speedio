import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'locations' })
export class Location {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  latitude: number;

  @Column()
  longitude: number;

  @Column({ default: true })
  roadCondition: RoadCondition;
}

export type RoadCondition =
  | 'COMFORTABLE' // 快適に走れる道
  | 'PASSABLE' // 狭い所もある程度は走れる道
  | 'UNPLEASANT' // 狭くて走りたくない道
  | 'UNCONFIRMED'; // 未確認
