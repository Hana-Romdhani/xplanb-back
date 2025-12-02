/**
 * Yjs WebSocket Server
 *
 * Backend WebSocket server for Yjs real-time collaboration
 * Handles document synchronization and user authentication
 *
 * Emplacement: src/yjs/yjs.gateway.ts
 */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }
})
export class YjsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(YjsGateway.name);
  private documents = new Map<string, Y.Doc>();
  private clients = new Map<string, { socket: Socket; userId: string; documentId: string }>();

  afterInit(server: Server) {
    this.logger.log('Yjs WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // Extract token from query parameters
      const token = client.handshake.query.token as string;
      const userId = client.handshake.query.userId as string;
      const userName = client.handshake.query.userName as string;
      const userColor = client.handshake.query.userColor as string;
      const documentId = client.handshake.query.documentId as string;

      if (!token || !userId || !documentId) {
        this.logger.warn('Connection rejected: Missing required parameters');
        client.disconnect();
        return;
      }

      // Verify JWT token
      const jwtService = new JwtService({
        secret:
          process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-make-it-long-and-random-12345'
      });

      try {
        const payload = jwtService.verify(token);
        client.data.userId = payload.id || userId;
        client.data.userName = userName;
        client.data.userColor = userColor;
        client.data.documentId = documentId;

        // Store client information
        this.clients.set(client.id, {
          socket: client,
          userId: client.data.userId,
          documentId: documentId
        });

        // Get or create document
        let doc = this.documents.get(documentId);
        if (!doc) {
          doc = new Y.Doc();
          this.documents.set(documentId, doc);
        }

        // Set up document synchronization
        this.setupDocumentSync(client, doc, documentId);

        this.logger.log(
          `User ${userName} (${client.data.userId}) connected to document ${documentId}`
        );
      } catch (error) {
        this.logger.warn(`Connection rejected: Invalid token - ${error.message}`);
        client.disconnect();
      }
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      this.logger.log(
        `User ${clientInfo.userId} disconnected from document ${clientInfo.documentId}`
      );
      this.clients.delete(client.id);
    }
  }

  private setupDocumentSync(client: Socket, doc: Y.Doc, documentId: string) {
    // Send initial document state to client
    const state = Y.encodeStateAsUpdate(doc);
    client.emit('sync', state);

    // Handle document updates from client
    client.on('update', (update: Uint8Array) => {
      try {
        // Apply update to document
        Y.applyUpdate(doc, update);

        // Broadcast update to other clients in the same document
        this.broadcastToDocument(documentId, 'update', update, client.id);
      } catch (error) {
        this.logger.error('Error applying update:', error);
      }
    });

    // Handle awareness updates (user presence)
    client.on('awareness', (awarenessUpdate: Uint8Array) => {
      this.broadcastToDocument(documentId, 'awareness', awarenessUpdate, client.id);
    });

    // Handle document sync requests
    client.on('sync', () => {
      const state = Y.encodeStateAsUpdate(doc);
      client.emit('sync', state);
    });
  }

  private broadcastToDocument(
    documentId: string,
    event: string,
    data: any,
    excludeClientId?: string
  ) {
    this.clients.forEach((clientInfo, clientId) => {
      if (clientInfo.documentId === documentId && clientId !== excludeClientId) {
        clientInfo.socket.emit(event, data);
      }
    });
  }

  // Get connected users for a document
  getConnectedUsers(
    documentId: string
  ): Array<{ userId: string; userName: string; userColor: string }> {
    const users: Array<{ userId: string; userName: string; userColor: string }> = [];

    this.clients.forEach((clientInfo) => {
      if (clientInfo.documentId === documentId) {
        users.push({
          userId: clientInfo.userId,
          userName: clientInfo.socket.data.userName || 'Unknown',
          userColor: clientInfo.socket.data.userColor || '#000000'
        });
      }
    });

    return users;
  }

  // Get document state
  getDocumentState(documentId: string): Uint8Array | null {
    const doc = this.documents.get(documentId);
    if (doc) {
      return Y.encodeStateAsUpdate(doc);
    }
    return null;
  }
}
