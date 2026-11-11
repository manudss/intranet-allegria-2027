import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { loadRuntimeConfig } from './app/core/runtime-config';

async function bootstrap() {
  await loadRuntimeConfig();
  await bootstrapApplication(App, appConfig);
}

void bootstrap().catch((error) => console.error('Angular bootstrap failed.', error));
