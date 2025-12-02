import { Module } from '@nestjs/common';
import { AdminSetupController } from './admin-setup.controller';
import { AdminSetupService } from './admin-setup.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AdminSetupController],
  providers: [AdminSetupService],
  exports: [AdminSetupService]
})
export class AdminSetupModule {}
