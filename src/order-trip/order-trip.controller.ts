import {
  Controller,
  Body,
  Param,
  ParseIntPipe,
  Get,
  Post,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { OrderTripService } from './order-trip.service';
import { OrderTrip } from './order-trip.interface';
import { CreateOrderTripDto } from './dto/create-order-trip.dto';
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

  @Post()
  async create(@Body() body: CreateOrderTripDto): Promise<OrderTrip> {
    return this.ordertripService.create(body);
  }

  @Delete('order/:orderId/trip/:tripId')
  async remove(
    @Param('orderId', ParseIntPipe) orderID: number,
    @Param('tripId', ParseIntPipe) tripId: number,
  ): Promise<void> {
    return this.ordertripService.remove(orderID, tripId);
  }
}
