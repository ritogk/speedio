import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Building } from './entities/building.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Building])],
})
export class BuildingsModule {}
