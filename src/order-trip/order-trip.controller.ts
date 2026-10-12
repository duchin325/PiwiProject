import {
  Controller,
  Param,
  ParseIntPipe,
  Get,
  UseGuards,
} from '@nestjs/common';
import { OrderTripService } from './order-trip.service';
import { OrderTrip } from './order-trip.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('order-trip')
export class OrderTripController {
  constructor(private readonly ordertripService: OrderTripService) {}

  @Get()
  async getAll(): Promise<OrderTrip[]> {
    return this.ordertripService.findAll();
  }

  @Get('order/:orderId')
  getOneByOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<OrderTrip[]> {
    return this.ordertripService.findOneByOrder(orderId);
  }

  @Get('trip/:tripId')
  getOneByTrip(
    @Param('tripId', ParseIntPipe) tripId: number,
  ): Promise<OrderTrip[]> {
    return this.ordertripService.findOneByTrip(tripId);
  }
}
