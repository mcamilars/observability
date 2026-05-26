import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = process.env.PORT;
  if (!port) throw new Error('Variable de entorno requerida: PORT');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableCors();
  await app.listen(parseInt(port));
}

bootstrap().catch((err) => {
  console.log(err);
});
