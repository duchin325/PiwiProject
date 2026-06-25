import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const configuredOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: configuredOrigins?.length ? configuredOrigins : defaultOrigins,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
