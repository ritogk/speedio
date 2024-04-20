import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';

export const setup = async (app: INestApplication) => {
  const documentBuilder = new DocumentBuilder()
    .setDescription('The cats API description')
    .setVersion('1.0')
    .addServer('https://localhost:5173/api', 'Development server')
    .build();
  const document = SwaggerModule.createDocument(app, documentBuilder);
  // swagger-viewerの起動
  SwaggerModule.setup('api', app, document);

  // openapi.ymlの出力
  const yamlDocument = yaml.dump(document, {
    skipInvalid: true,
    noRefs: true,
  });
  const yamlPath = path.join(__dirname, '../public', 'openapi.yml');
  await fs.writeFile(yamlPath, yamlDocument);
};
