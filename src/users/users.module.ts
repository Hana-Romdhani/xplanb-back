import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './users.schema';
import { UserRepository } from './users.repository';

@Module({
  providers: [UsersService, UserRepository],
  controllers: [UsersController],
  exports: [UsersService, MongooseModule, UserRepository],
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])]
})
export class UsersModule {}
