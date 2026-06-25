import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { TripStopsController } from './trip-stops.controller';
import { TripStopsService } from './trip-stops.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TripStopsController],
  providers: [TripStopsService],
})
export class TripStopsModule {}
