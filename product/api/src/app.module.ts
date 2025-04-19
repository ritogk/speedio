import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from './items/entities/item.entity';
import { ItemsModule } from './items/items.module';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'speedio_p',
      entities: [Item],
      synchronize: true,
      // logging: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'), // ここで静的ファイルが置かれるディレクトリを指定
      serveRoot: '/public', // URLパスのプレフィックス（任意）
      renderPath: '*', // 任意のファイルパスやファイル名にアクセス可能にする
    }),
    ItemsModule,
  ],
  providers: [AppService],
})
export class AppModule {}
