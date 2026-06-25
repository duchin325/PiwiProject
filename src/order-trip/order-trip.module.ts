import { Module } from '@nestjs/common';
import { OrderTripService } from './order-trip.service';
import { OrderTripController } from './order-trip.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [OrderTripService],
  controllers: [OrderTripController],
})
export class OrderTripModule {}
