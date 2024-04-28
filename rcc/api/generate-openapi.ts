import { AppModule } from './src/app.module';
import { NestFactory } from '@nestjs/core';
import { setup } from './src/openapi';

/**
 * npm scriptで実行する用の関数
 */
(async () => {
  const app = await NestFactory.create(AppModule);
  await setup(app);
  app.close();
})();
