import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'items' })
export class Item {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'id' })
  id: number;

  @Column({
    type: 'text',
    default: false,
  })
  @ApiProperty({
    description: 'テキスト',
  })
  text: string;

  @CreateDateColumn()
  @ApiProperty({ description: '作成日時' })
  created_at: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: '更新日時' })
  updated_at: Date;

  @DeleteDateColumn()
  @ApiProperty({ description: '削除日時' })
  deletedAt: Date | null;
}
