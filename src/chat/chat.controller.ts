import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const StartChatSchema = z.object({
  flowType: z.enum(['CRY', 'FACE', 'SKIN', 'UNKNOWN', 'GREETING']),
});
export class StartChatDto extends createZodDto(StartChatSchema) {}

const AnswerChatSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  answer: z.string().trim().min(1, 'Answer is required'),
});
export class AnswerChatDto extends createZodDto(AnswerChatSchema) {}

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a new chat session (Optional Auth)' })
  @UseGuards(OptionalJwtAuthGuard)
  @Post('start')
  async start(@Body() body: StartChatDto, @Request() req: any) {
    return this.chatService.startChat(body.flowType, req.user?.userId);
  }

  @ApiOperation({ summary: 'Answer the current chat node' })
  @Post('answer')
  async answer(@Body() body: AnswerChatDto) {
    return this.chatService.answerChat(body.sessionId, body.answer);
  }
}
