import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from './locations/entities/location.entity';
import { LocationsModule } from './locations/locations.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'speedia',
      password: 'P@ssw0rd',
      database: 'speedia',
      entities: [Location],
      synchronize: true,
    }),
    LocationsModule,
  ],
  providers: [AppService],
})
export class AppModule {}
