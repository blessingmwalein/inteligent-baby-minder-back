import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { LlmModule } from '../llm/llm.module';
import { SafetyModule } from '../safety/safety.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [LlmModule, SafetyModule, AuthModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
