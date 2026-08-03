import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { TripBatchesService } from './trip-batches.service';
import {
  TripBatch,
  TripBatchTrip,
  TripBatchWithDriver,
} from './interfaces/trip-batch.interface';
import { CreateTripBatchDto } from './dto/create-trip-batch.dto';
import { UpdateTripBatchDto } from './dto/update-trip-batch.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('trip-batches')
export class TripBatchesController {
  constructor(private readonly tripBatchesService: TripBatchesService) {}

  @Get()
  async getAll(): Promise<TripBatchWithDriver[]> {
    return this.tripBatchesService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number): Promise<TripBatch> {
    const batch = await this.tripBatchesService.findOne(id);
    if (!batch) {
      throw new NotFoundException(`La salida con id ${id} no se encuentra`);
    }

    return batch;
  }

  @Get(':id/trips')
  async getTrips(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TripBatchTrip[]> {
    return this.tripBatchesService.findTrips(id);
  }

  @Post()
  async create(@Body() body: CreateTripBatchDto): Promise<TripBatch> {
    return this.tripBatchesService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTripBatchDto,
  ): Promise<TripBatch> {
    return this.tripBatchesService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tripBatchesService.remove(id);
  }
}
