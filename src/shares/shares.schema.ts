/**
 * Shares Schema
 *
 * Ce schema gère les partages de documents et dossiers avec différents niveaux d'accès
 * et support pour les liens publics avec expiration.
 *
 * Emplacement: src/shares/shares.schema.ts
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/users/users.schema';

export type ShareDocument = Share & Document;

@Schema({ timestamps: true })
export class Share {
  @Prop({ type: String, required: true, unique: true })
  token: string; // UUID ou JWT pour l'accès

  @Prop({ type: String, required: true, enum: ['document', 'folder'] })
  resourceType: string;

  @Prop({ type: Types.ObjectId, required: true })
  resourceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  sharedWith?: Types.ObjectId; // null pour les liens publics

  @Prop({ type: String, enum: ['view', 'comment', 'edit'], default: 'view' })
  role: string;

  @Prop({ type: Date, required: false })
  expiresAt?: Date; // null pour les liens permanents

  @Prop({ type: Boolean, default: false })
  isPublic: boolean; // true pour les liens publics

  @Prop({ type: String, required: false })
  password?: string; // mot de passe optionnel pour les liens publics

  @Prop({ type: Number, default: 0 })
  accessCount: number; // compteur d'accès

  @Prop({ type: Date, required: false })
  lastAccessedAt?: Date;
}

export const ShareSchema = SchemaFactory.createForClass(Share);
