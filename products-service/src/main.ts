import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = process.env.PORT;
  if (!port) throw new Error('Variable de entorno requerida: PORT');
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(parseInt(port));
}

bootstrap().catch((err) => {
  console.log(err);
});
