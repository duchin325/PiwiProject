import { Module } from '@nestjs/common';
import { TripBatchesService } from './trip-batches.service';
import { TripBatchesController } from './trip-batches.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [TripBatchesService],
  controllers: [TripBatchesController],
})
export class TripBatchesModule {}
