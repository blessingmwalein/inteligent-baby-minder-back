import { Controller, Post, Body } from '@nestjs/common';
import { NlpService, IntentOutput } from './nlp.service';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

const IntentSchema = z.object({
  message: z.string().trim().min(1, 'Message is required'),
});

export class IntentDto extends createZodDto(IntentSchema) {}

@ApiTags('NLP')
@Controller('nlp')
export class NlpController {
  constructor(private readonly nlpService: NlpService) {}

  @ApiOperation({ summary: 'Detect issue intent from text' })
  @Post('intent')
  async detectIntent(@Body() body: IntentDto): Promise<{ intent: IntentOutput }> {
    const intent = await this.nlpService.detectIntent(body.message);
    return { intent };
  }
}
