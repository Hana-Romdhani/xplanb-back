import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PomodoroController } from './pomodoro.controller';
import { PomodoroService } from './pomodoro.service';
import { PomodoroSession, PomodoroSessionSchema } from './pomodoro.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PomodoroSession.name, schema: PomodoroSessionSchema }])
  ],
  controllers: [PomodoroController],
  providers: [PomodoroService],
  exports: [PomodoroService]
})
export class PomodoroModule {}
