import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
//import * as openapi from './generate-openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // await openapi.setup(app);
  await app.listen(3000);
}
bootstrap();
