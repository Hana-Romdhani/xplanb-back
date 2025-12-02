import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChartsController } from './charts.controller';
import { ChartsService } from './charts.service';
import { ChartComment, ChartCommentSchema } from './chart-comment.schema';
import { ChartVersion, ChartVersionSchema } from './chart-version.schema';
import { ChartMetadata, ChartMetadataSchema } from './chart-metadata.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChartComment.name, schema: ChartCommentSchema },
      { name: ChartVersion.name, schema: ChartVersionSchema },
      { name: ChartMetadata.name, schema: ChartMetadataSchema }
    ])
  ],
  controllers: [ChartsController],
  providers: [ChartsService],
  exports: [ChartsService]
})
export class ChartsModule {}
