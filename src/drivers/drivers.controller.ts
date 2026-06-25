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
import { DriversService } from './drivers.service';
import { Driver } from './drivers.interface';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  async getAll(): Promise<Driver[]> {
    return this.driversService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number): Promise<Driver> {
    const driver = await this.driversService.findOne(id);

    if (!driver) {
      throw new NotFoundException(`El conductor con id ${id} no se encuentra`);
    }

    return driver;
  }

  @Post()
  async create(@Body() dto: CreateDriverDto): Promise<{ id: number }> {
    const id = await this.driversService.create(dto);
    return { id };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDriverDto,
  ): Promise<void> {
    return this.driversService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.driversService.remove(id);
  }
}
