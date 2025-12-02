import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
const cors = require('cors');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

  // Serve static files from uploads directory
  // When running from dist folder, go up one level to find uploads
  const uploadsPath = join(process.cwd(), 'uploads');
  console.log('📁 Serving static files from:', uploadsPath);

  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/'
  });

  const corsOptions = {
    credentials: true,
    optionSuccessStatus: 200
  };
  app.use(cors(corsOptions));
  app.enableCors();

  await app.listen(3000);

  console.log('');
  console.log('🚀 XPlanB Backend Server Started!');
  console.log('================================');
  console.log('🌐 Backend API: http://localhost:3000');
  console.log('🌐 Frontend: http://localhost:5173');
  console.log('');
  console.log('🔑 Admin Credentials:');
  console.log('📧 Email: admin@xplanb.com');
  console.log('🔑 Password: Admin123!');
  console.log('👤 Role: ADMIN');
  console.log('');
  console.log('🎯 Admin Features:');
  console.log('   ✅ View all user complaints');
  console.log('   ✅ Update complaint status');
  console.log('   ✅ Access system-wide analytics');
  console.log('   ✅ Monitor user activity logs');
  console.log('   ✅ Manage user permissions');
  console.log('');
}
bootstrap();
