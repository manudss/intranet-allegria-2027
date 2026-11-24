import { configureFamilyPortal } from './app/config/family-portal-hosting';
import { Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { parseCorsOrigins } from './app/config/environment';
import { configureTrustProxy } from './app/config/trust-proxy';
import { configureExtraMounts, configureWebHosting, resolveExtraMounts, resolveWebStaticDir } from './app/config/web-hosting';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  try {
    app.enableShutdownHooks();
    configureTrustProxy(app);

    const configService = app.get(ConfigService);
    const globalPrefix = 'api';
    const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:4200');
    const port = configService.get<number>('PORT', 3000);

    app.enableCors({
      origin: parseCorsOrigins(corsOrigin),
      credentials: false,
    });
    app.setGlobalPrefix(globalPrefix, {
      exclude: [{ path: 'health', method: RequestMethod.GET }],
    });

    const swaggerConfig = new DocumentBuilder()
      .setTitle('MEJ Alegria 2027 API')
      .setDescription(
        'API REST Intranet Alegria 2027 - participants, equipes, hebergement, sante et RBAC',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'token',
          description: 'Token retourne par POST /api/auth/login',
        },
        'bearer',
      )
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, swaggerDocument, {
      swaggerOptions: { persistAuthorization: true },
    });

    configureFamilyPortal(app);
    const webStaticDir = resolveWebStaticDir(configService.get<string>('WEB_STATIC_DIR'));
    if (webStaticDir) {
      configureExtraMounts(app, resolveExtraMounts(configService.get<string>('EXTRA_STATIC_MOUNTS')));
      configureWebHosting(app, webStaticDir);
      logger.log(`Serving the web app from ${webStaticDir} (preview mode)`);
    }

    await app.listen(port, '0.0.0.0');
    logger.log(`Application is running on ${await app.getUrl()}/${globalPrefix}`);
    logger.log(`Swagger is available on ${await app.getUrl()}/${globalPrefix}/docs`);
  } catch (error) {
    logger.error(
      'Application startup failed.',
      error instanceof Error ? error.stack : String(error),
    );
    await app.close();
    throw error;
  }
}

void bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Fatal startup error.', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
