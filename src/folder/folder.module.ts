import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Folder, FolderSchema } from './folder.schema';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';
import { FolderRepository } from './folder.repository';
import { UsersService } from '../users/users.service';
import { UserRepository } from '../users/users.repository';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

@Module({
  controllers: [FolderController],
  exports: [MongooseModule, FolderRepository],
  providers: [FolderService, FolderRepository, UsersService, UserRepository],
  imports: [
    MongooseModule.forFeature([{ name: Folder.name, schema: FolderSchema }]),
    UsersModule,
    EmailModule
  ]
})
export class FolderModule {}
