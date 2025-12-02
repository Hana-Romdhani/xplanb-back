/**
 * Realtime DTOs
 *
 * DTOs pour les événements WebSocket de co-édition temps-réel
 *
 * Emplacement: src/realtime/dto/realtime.dto.ts
 */

import { IsString, IsObject, IsOptional, IsNumber, IsArray } from 'class-validator';

export class JoinDocumentDto {
  @IsString()
  documentId: string;
}

export class ContentUpdateDto {
  @IsString()
  documentId: string;

  @IsObject()
  content: any; // Editor.js content ou delta

  @IsOptional()
  @IsString()
  blockId?: string; // ID du bloc modifié pour les deltas

  @IsOptional()
  @IsString()
  operation?: 'insert' | 'update' | 'delete'; // Type d'opération
}

export class CursorUpdateDto {
  @IsString()
  documentId: string;

  @IsObject()
  cursor: {
    x: number;
    y: number;
    blockId?: string;
    selection?: {
      start: number;
      end: number;
    };
  };

  @IsString()
  user: string; // userId
}

export class PresenceUpdateDto {
  @IsString()
  documentId: string;

  @IsArray()
  users: Array<{
    id: string;
    name: string;
    color: string;
    cursor?: {
      x: number;
      y: number;
      blockId?: string;
    };
  }>;
}

export class SaveSnapshotDto {
  @IsString()
  documentId: string;

  @IsObject()
  content: any;

  @IsOptional()
  @IsString()
  description?: string;
}
