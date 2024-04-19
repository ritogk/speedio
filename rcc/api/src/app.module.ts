import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from './locations/entities/location.entity';
import { LocationsModule } from './locations/locations.module';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

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
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'), // ここで静的ファイルが置かれるディレクトリを指定
      serveRoot: '/public', // URLパスのプレフィックス（任意）
      renderPath: '*', // 任意のファイルパスやファイル名にアクセス可能にする
    }),
    LocationsModule,
  ],
  providers: [AppService],
})
export class AppModule {}
