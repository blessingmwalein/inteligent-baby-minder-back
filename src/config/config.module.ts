import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import loadAndValidateConfig from './configuration';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [() => loadAndValidateConfig()],
    }),
  ],
})
export class AppConfigModule {}
