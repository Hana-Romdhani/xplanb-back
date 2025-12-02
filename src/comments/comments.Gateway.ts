import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*'
  }
})
export class CommentsGateway {
  @WebSocketServer()
  server: Server;
  @SubscribeMessage('events')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findAll(@MessageBody() data: any): any {
    return true;
  }
}
