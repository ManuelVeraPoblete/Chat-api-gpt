import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/message.schema';

import { OpenAiService } from './openai/openai.service';

/**
 * ✅ ChatModule
 * - Registra schemas de Mongo (conversación y mensajes)
 * - Expone endpoints REST: GET y POST mensajes
 * - Lógica en ChatService
 * - OpenAI aislado en OpenAiService (SRP)
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, OpenAiService],
})
export class ChatModule {}
