import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ChatModule } from './chat/chat.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/config.module';
import { LlmModule } from './llm/llm.module';
import { SafetyModule } from './safety/safety.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'global',
          ttl: 60_000,
          limit: config.get<number>('GLOBAL_RATE_LIMIT_PER_MIN') ?? 60,
        },
      ],
    }),
    LlmModule,
    SafetyModule,
    ChatModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
