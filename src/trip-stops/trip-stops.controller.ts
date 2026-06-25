import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CreateTripStopDto } from './dto/create-trip-stop.dto';
import { UpdateTripStopDto } from './dto/update-trip-stop.dto';
import { TripStop } from './trip-stop.interface';
import { TripStopsService } from './trip-stops.service';

@Controller('trip-stops')
export class TripStopsController {
  constructor(private readonly tripStopsService: TripStopsService) {}

  @Get()
  async getAll(): Promise<TripStop[]> {
    return this.tripStopsService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number): Promise<TripStop> {
    const tripStop = await this.tripStopsService.findOne(id);

    if (!tripStop) {
      throw new NotFoundException(`La parada con id ${id} no se encuentra`);
    }

    return tripStop;
  }

  @Get('trip/:tripId')
  async getByTrip(
    @Param('tripId', ParseIntPipe) tripId: number,
  ): Promise<TripStop[]> {
    return this.tripStopsService.findByTrip(tripId);
  }

  @Post()
  async create(@Body() dto: CreateTripStopDto): Promise<{ id: number }> {
    const id = await this.tripStopsService.create(dto);
    return { id };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTripStopDto,
  ): Promise<void> {
    return this.tripStopsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tripStopsService.remove(id);
  }
}
