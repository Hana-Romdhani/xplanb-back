/**
 * Yjs Module
 *
 * Module for Yjs real-time collaboration
 *
 * Emplacement: src/yjs/yjs.module.ts
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { YjsGateway } from './yjs.gateway';
import { YjsController } from './yjs.controller';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret:
          configService.get('SECRET_KEY') ||
          'your-super-secret-jwt-key-here-make-it-long-and-random-12345',
        signOptions: { expiresIn: '1d' }
      }),
      inject: [ConfigService]
    })
  ],
  providers: [YjsGateway],
  controllers: [YjsController],
  exports: [YjsGateway]
})
export class YjsModule {}
