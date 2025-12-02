import { Module } from '@nestjs/common';
import { OpenAiController } from './open-ai.controller';
import { OpenAiService } from './open-ai.service';
import { DocumentModule } from '../document/document.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/users.schema';
import { Content, ContentSchema } from '../content/content.schema';

@Module({
  imports: [
    DocumentModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Content.name, schema: ContentSchema }
    ])
  ],
  controllers: [OpenAiController],
  providers: [OpenAiService]
})
export class OpenAiModule {}
