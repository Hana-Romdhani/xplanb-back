import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsOptional()
  metadata?: any;
}

export class CreateConversationDto {
  @IsArray()
  @IsNotEmpty()
  participantIds: string[];

  @IsEnum(['direct', 'group'])
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class UpdateConversationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsOptional()
  participantIds?: string[];
}
