/**
 * Yjs HTTP Server
 *
 * Simple HTTP-based Yjs server for real-time collaboration
 * Uses HTTP endpoints instead of WebSocket for better compatibility
 *
 * Emplacement: src/yjs/yjs.controller.ts
 */

import { Controller, Post, Get, Body, Param, Headers, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as Y from 'yjs';

@Controller('yjs')
export class YjsController {
  private documents = new Map<string, Y.Doc>();
  private clients = new Map<string, { userId: string; documentId: string; lastSeen: Date }>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  @Post('sync/:documentId')
  @UseGuards(JwtAuthGuard)
  async syncDocument(
    @Param('documentId') documentId: string,
    @Body() body: { update?: string; state?: string },
    @Headers('authorization') auth: string
  ) {
    try {
      // Extract user info from JWT
      const token = auth.replace('Bearer ', '');
      const payload = this.jwtService.verify(token);
      const userId = payload.id;

      // Get or create document
      let doc = this.documents.get(documentId);
      if (!doc) {
        doc = new Y.Doc();
        this.documents.set(documentId, doc);
      }

      // Update client info
      this.clients.set(`${userId}-${documentId}`, {
        userId,
        documentId,
        lastSeen: new Date()
      });

      // Handle incoming update
      if (body.update) {
        const update = Uint8Array.from(JSON.parse(body.update));
        Y.applyUpdate(doc, update);
      }

      // Return current state
      const state = Y.encodeStateAsUpdate(doc);
      return {
        update: Array.from(state),
        clients: this.getConnectedClients(documentId)
      };
    } catch (error) {
      console.error('Yjs sync error:', error);
      throw error;
    }
  }

  @Get('state/:documentId')
  @UseGuards(JwtAuthGuard)
  async getDocumentState(
    @Param('documentId') documentId: string,
    @Headers('authorization') auth: string
  ) {
    try {
      const token = auth.replace('Bearer ', '');
      const payload = this.jwtService.verify(token);
      const userId = payload.id;

      const doc = this.documents.get(documentId);
      if (!doc) {
        return { update: [], clients: [] };
      }

      const state = Y.encodeStateAsUpdate(doc);
      return {
        update: Array.from(state),
        clients: this.getConnectedClients(documentId)
      };
    } catch (error) {
      console.error('Yjs state error:', error);
      throw error;
    }
  }

  @Get('clients/:documentId')
  @UseGuards(JwtAuthGuard)
  async getDocumentClients(
    @Param('documentId') documentId: string,
    @Headers('authorization') auth: string
  ) {
    try {
      const token = auth.replace('Bearer ', '');
      const payload = this.jwtService.verify(token);

      return {
        clients: this.getConnectedClients(documentId)
      };
    } catch (error) {
      console.error('Yjs clients error:', error);
      throw error;
    }
  }

  private getConnectedClients(documentId: string): Array<{ userId: string; lastSeen: Date }> {
    const now = new Date();
    const clients: Array<{ userId: string; lastSeen: Date }> = [];

    this.clients.forEach((client, key) => {
      if (client.documentId === documentId) {
        // Remove clients that haven't been seen in the last 30 seconds
        if (now.getTime() - client.lastSeen.getTime() < 30000) {
          clients.push({
            userId: client.userId,
            lastSeen: client.lastSeen
          });
        } else {
          this.clients.delete(key);
        }
      }
    });

    return clients;
  }
}
