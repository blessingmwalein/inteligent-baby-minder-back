import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@ApiTags('Chat')
@Controller('chat/sessions')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new chat session (auth optional)' })
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async createSession(@Request() req: any) {
    return this.chatService.createSession(req.user?.userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the authenticated user\'s chat sessions' })
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async listSessions(@Request() req: any) {
    return this.chatService.listSessions(req.user.userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch a session\'s message history (auth optional)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/messages')
  async getMessages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: any,
  ) {
    return this.chatService.getMessages(id, req.user?.userId);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send a user message; safety filter → Gemini → assistant reply',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/messages')
  async sendMessage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SendMessageDto,
    @Request() req: any,
  ) {
    return this.chatService.sendMessage(id, body.content, req.user?.userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a chat session and its messages' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @UseGuards(OptionalJwtAuthGuard)
  @Delete(':id')
  async deleteSession(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: any,
  ) {
    return this.chatService.deleteSession(id, req.user?.userId);
  }
}
