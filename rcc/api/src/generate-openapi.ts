import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';

export const generate = async () => {
  const app = await NestFactory.create(AppModule);
  const documentBuilder = new DocumentBuilder()
    .setDescription('The cats API description')
    .setVersion('1.0')
    // .addServer('https://localhost:5173/api', 'Development server')
    .build();
  const document = SwaggerModule.createDocument(app, documentBuilder);
  // swagger-viewerの起動
  SwaggerModule.setup('api', app, document);

  // openapi.ymlの出力
  const yamlDocument = yaml.dump(document, {
    skipInvalid: true,
    noRefs: true,
  });
  // const yamlPath = path.join(__dirname, '../public', 'openapi.yml');
  // あとで直す。
  const yamlPath = path.join(
    '/home/ubuntu/speedio/rcc/api/public',
    'openapi.yml',
  );
  await fs.writeFile(yamlPath, yamlDocument);
};

(async () => await generate())();
