/**
 * Realtime Gateway
 *
 * Gateway WebSocket pour la co-édition temps-réel des documents
 * Gère l'authentification JWT, les rooms par document et les événements temps-réel
 *
 * Emplacement: src/realtime/realtime.gateway.ts
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RealtimeService } from './realtime.service';
import {
  JoinDocumentDto,
  ContentUpdateDto,
  CursorUpdateDto,
  SaveSnapshotDto
} from './dto/realtime.dto';
import * as Y from 'yjs';

@WebSocketGateway({
  namespace: '/ws/docs',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  // Yjs document instances for each document
  private yjsDocs = new Map<string, Y.Doc>();

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly jwtService: JwtService
  ) {}

  /**
   * Gestion de la connexion WebSocket
   */
  async handleConnection(client: Socket) {
    try {
      // Authentifier l'utilisateur via JWT
      const token = this.extractTokenFromSocket(client);
      if (!token) {
        this.logger.warn('Connection rejected: No token provided');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.id;
      client.data.userEmail = payload.email;

      this.logger.log(`User ${payload.email} connected with socket ${client.id}`);
    } catch (error) {
      this.logger.warn(`Connection rejected: Invalid token - ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Gestion de la déconnexion WebSocket
   */
  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const documentId = client.data.documentId;

    if (userId) {
      // Sauvegarder le contenu Yjs avant de quitter
      if (documentId) {
        const ydoc = this.yjsDocs.get(documentId);
        if (ydoc) {
          try {
            const ytext = ydoc.getText('editor');
            let content = ytext.toString();

            // Handle concatenated JSON objects if present
            if (content && content.includes('}{')) {
              this.logger.warn(
                `⚠️ Detected concatenated JSON on disconnect, extracting most recent`
              );

              const jsonObjects: string[] = [];
              let braceCount = 0;
              let objectStart = -1;

              for (let i = 0; i < content.length; i++) {
                if (content[i] === '{') {
                  if (braceCount === 0) objectStart = i;
                  braceCount++;
                } else if (content[i] === '}') {
                  braceCount--;
                  if (braceCount === 0 && objectStart !== -1) {
                    jsonObjects.push(content.substring(objectStart, i + 1));
                    objectStart = -1;
                  }
                }
              }

              if (jsonObjects.length > 0) {
                content = jsonObjects[jsonObjects.length - 1];
              }
            }

            if (content) {
              const jsonContent = JSON.parse(content);
              await this.realtimeService.updateContent(documentId, jsonContent, userId);
              this.logger.log(`Saved Yjs content for document ${documentId} on user disconnect`);
            }
          } catch (error) {
            this.logger.error(`Error saving Yjs content on disconnect: ${error.message}`);
          }
        }

        await this.realtimeService.saveSnapshot(documentId);
        this.realtimeService.leaveDocument(documentId, userId);

        // Notifier les autres utilisateurs
        this.server.to(documentId).emit('user_left', {
          userId,
          documentId
        });
      }

      this.logger.log(`User ${userId} disconnected`);
    }
  }

  /**
   * Rejoindre un document
   */
  @SubscribeMessage('join_document')
  async handleJoinDocument(
    @MessageBody() data: JoinDocumentDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      this.logger.warn('❌ join_document: No userId in client.data');
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    this.logger.log(`📥 join_document request: documentId=${data.documentId}, userId=${userId}`);

    try {
      const result = await this.realtimeService.joinDocument(data.documentId, userId, client.id);

      this.logger.log(`🔐 Access check result: ${result.success}`);

      if (result.success) {
        // Rejoindre la room Socket.IO
        await client.join(data.documentId);
        client.data.documentId = data.documentId;

        // Obtenir ou créer le document Yjs
        let ydoc = this.yjsDocs.get(data.documentId);
        if (!ydoc) {
          ydoc = new Y.Doc();
          this.yjsDocs.set(data.documentId, ydoc);

          // Initialiser le document avec le contenu depuis MongoDB
          if (result.content && result.content.blocks) {
            try {
              const ytext = ydoc.getText('editor');
              ytext.insert(0, JSON.stringify(result.content));
              this.logger.log(`✅ Initialized Yjs document ${data.documentId} with content`);
            } catch (error) {
              this.logger.error(`❌ Error initializing Yjs document: ${error.message}`);
            }
          }
        }

        // Envoyer l'état complet du document Yjs au client
        const stateVector = Y.encodeStateAsUpdate(ydoc);

        client.emit('document_joined', {
          documentId: data.documentId,
          content: result.content,
          users: result.users
        });

        // Envoyer l'état Yjs
        client.emit('yjs_sync', Array.from(stateVector));
        this.logger.log(`📤 Sent yjs_sync with ${stateVector.length} bytes`);

        // Notifier les autres utilisateurs
        client.to(data.documentId).emit('user_joined', {
          userId,
          documentId: data.documentId,
          users: result.users
        });

        this.logger.log(`✅ User ${userId} joined document ${data.documentId}`);
      } else {
        this.logger.warn(
          `❌ Access denied: User ${userId} cannot access document ${data.documentId}`
        );
        client.emit('error', { message: 'Access denied to document' });
      }
    } catch (error) {
      this.logger.error(`❌ Error joining document: ${error.message}`);
      this.logger.error(error.stack);
      client.emit('error', { message: 'Failed to join document' });
    }
  }

  /**
   * Mise à jour du contenu
   */
  @SubscribeMessage('content_update')
  async handleContentUpdate(
    @MessageBody() data: ContentUpdateDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      // Mettre à jour le contenu dans le service
      await this.realtimeService.updateContent(data.documentId, data.content, userId);

      // Diffuser aux autres utilisateurs (pas à l'expéditeur)
      client.to(data.documentId).emit('content_updated', {
        documentId: data.documentId,
        content: data.content,
        blockId: data.blockId,
        operation: data.operation,
        userId
      });

      this.logger.debug(`Content updated for document ${data.documentId} by user ${userId}`);
    } catch (error) {
      this.logger.error(`Error updating content: ${error.message}`);
      client.emit('error', { message: 'Failed to update content' });
    }
  }

  /**
   * Mise à jour du curseur
   */
  @SubscribeMessage('cursor_update')
  async handleCursorUpdate(
    @MessageBody() data: CursorUpdateDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return;
    }

    try {
      // Mettre à jour la position du curseur
      this.realtimeService.updateCursor(data.documentId, userId, data.cursor);

      // Diffuser aux autres utilisateurs
      client.to(data.documentId).emit('cursor_updated', {
        documentId: data.documentId,
        userId,
        cursor: data.cursor
      });
    } catch (error) {
      this.logger.error(`Error updating cursor: ${error.message}`);
    }
  }

  /**
   * Sauvegarde manuelle
   */
  @SubscribeMessage('save_snapshot')
  async handleSaveSnapshot(
    @MessageBody() data: SaveSnapshotDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      // Si du contenu est fourni, le sauvegarder d'abord
      if (data.content) {
        await this.realtimeService.updateContent(data.documentId, data.content, userId);
      }

      const success = await this.realtimeService.saveSnapshot(data.documentId, data.description);

      if (success) {
        client.emit('snapshot_saved', {
          documentId: data.documentId,
          timestamp: new Date()
        });
      } else {
        client.emit('error', { message: 'Failed to save snapshot' });
      }
    } catch (error) {
      this.logger.error(`Error saving snapshot: ${error.message}`);
      client.emit('error', { message: 'Failed to save snapshot' });
    }
  }

  /**
   * Gérer les mises à jour Yjs (REAL-TIME SYNC)
   */
  @SubscribeMessage('yjs_update')
  async handleYjsUpdate(
    @MessageBody() data: { documentId: string; update: number[]; timestamp?: number },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      this.logger.warn('❌ yjs_update: No userId in client.data');
      return;
    }

    try {
      const documentId = data.documentId;
      const ydoc = this.yjsDocs.get(documentId);

      if (!ydoc) {
        this.logger.warn(`❌ Yjs document not found for ${documentId}`);
        // Create a new YJS document if it doesn't exist
        const newYdoc = new Y.Doc();
        this.yjsDocs.set(documentId, newYdoc);

        // Apply the update to the new document
        const update = new Uint8Array(data.update);
        Y.applyUpdate(newYdoc, update);

        // Broadcast to all clients in the room (including sender for consistency)
        this.server.to(documentId).emit('yjs_update', {
          documentId,
          update: data.update,
          timestamp: data.timestamp || Date.now()
        });

        this.logger.log(`✅ Created new Yjs document for ${documentId} and applied update`);
        return;
      }

      // Convertir le tableau de nombres en Uint8Array
      const update = new Uint8Array(data.update);

      // Appliquer la mise à jour au document Yjs
      Y.applyUpdate(ydoc, update);

      // Extract content from YJS document for potential auto-save
      const ytext = ydoc.getText('editor');
      if (ytext && ytext.length > 0) {
        try {
          let contentString = ytext.toString();

          // Handle concatenated JSON objects by extracting the most recent one
          if (contentString.includes('}{')) {
            this.logger.warn(
              `⚠️ YJS: Detected concatenated JSON in content, extracting the most recent object`
            );

            // Find all JSON object boundaries
            const jsonObjects: string[] = [];
            let braceCount = 0;
            let objectStart = -1;

            for (let i = 0; i < contentString.length; i++) {
              if (contentString[i] === '{') {
                if (braceCount === 0) {
                  objectStart = i;
                }
                braceCount++;
              } else if (contentString[i] === '}') {
                braceCount--;
                if (braceCount === 0 && objectStart !== -1) {
                  jsonObjects.push(contentString.substring(objectStart, i + 1));
                  objectStart = -1;
                }
              }
            }

            // Use the last (most recent) JSON object
            if (jsonObjects.length > 0) {
              contentString = jsonObjects[jsonObjects.length - 1];
              this.logger.debug(
                `✅ YJS: Extracted most recent JSON object from ${jsonObjects.length} concatenated objects`
              );
            } else {
              this.logger.warn(
                `⚠️ YJS: Failed to extract valid JSON from concatenated objects, skipping`
              );
              throw new Error('Failed to parse concatenated JSON');
            }
          }

          const content = JSON.parse(contentString);

          // Update room content and trigger auto-save after significant changes
          await this.realtimeService.updateContent(documentId, content, userId);
        } catch (parseError) {
          // Content might not be valid JSON yet, skip auto-save
          this.logger.debug(
            `Content not yet valid JSON, skipping auto-save: ${parseError.message}`
          );
        }
      }

      // Diffuser la mise à jour à tous les clients dans la room (y compris l'expéditeur pour la cohérence)
      this.server.to(documentId).emit('yjs_update', {
        documentId,
        update: data.update,
        timestamp: data.timestamp || Date.now()
      });

      this.logger.debug(`✅ Yjs update applied for document ${documentId} by user ${userId}`);
    } catch (error) {
      this.logger.error(`❌ Error applying Yjs update: ${error.message}`);
      // Don't disconnect the client, just log the error
    }
  }

  /**
   * Quitter un document
   */
  @SubscribeMessage('leave_document')
  async handleLeaveDocument(
    @MessageBody() data: { documentId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return;
    }

    try {
      // Quitter la room Socket.IO
      await client.leave(data.documentId);

      // Retirer l'utilisateur du service
      this.realtimeService.leaveDocument(data.documentId, userId);

      // Notifier les autres utilisateurs
      client.to(data.documentId).emit('user_left', {
        userId,
        documentId: data.documentId
      });

      this.logger.log(`User ${userId} left document ${data.documentId}`);
    } catch (error) {
      this.logger.error(`Error leaving document: ${error.message}`);
    }
  }

  /**
   * Demander la liste des utilisateurs connectés
   */
  @SubscribeMessage('get_presence')
  async handleGetPresence(
    @MessageBody() data: { documentId: string },
    @ConnectedSocket() client: Socket
  ) {
    const users = this.realtimeService.getConnectedUsers(data.documentId);
    client.emit('presence_update', {
      documentId: data.documentId,
      users
    });
  }

  /**
   * Extraire le token JWT du socket
   */
  private extractTokenFromSocket(client: Socket): string | null {
    // Essayer d'abord dans auth object (Socket.IO standard)
    if (client.handshake.auth && client.handshake.auth.token) {
      return client.handshake.auth.token;
    }

    // Essayer dans les headers Authorization
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Essayer dans les query parameters
    const token = client.handshake.query.token as string;
    if (token) {
      return token;
    }

    return null;
  }

  /**
   * Récupérer les rooms d'un utilisateur
   */
  private getUserRooms(client: Socket): string[] {
    const rooms: string[] = [];
    for (const [roomName, room] of client.rooms) {
      if (roomName !== client.id) {
        rooms.push(roomName);
      }
    }
    return rooms;
  }
}
