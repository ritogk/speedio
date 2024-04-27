import { Injectable } from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Location } from './entities/location.entity';
import { Repository } from 'typeorm';
import { plainToClass } from 'class-transformer';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
  ) {}

  async create(createLocationDto: CreateLocationDto): Promise<Location> {
    const location = plainToClass(Location, createLocationDto);
    location.geometry = {
      type: 'Point',
      coordinates: [createLocationDto.longitude, createLocationDto.latitude],
    };
    return await this.locationRepository.save(location);
  }

  async findAll(): Promise<Location[]> {
    return this.locationRepository.find();
  }

  async findOne(id: number): Promise<Location> {
    return await this.locationRepository.findOne({ where: { id } });
  }

  async update(
    id: number,
    updateLocationDto: UpdateLocationDto,
  ): Promise<Location> {
    return this.locationRepository.save({
      id: id,
      ...updateLocationDto,
    });
  }

  async remove(id: number): Promise<void> {
    await this.locationRepository.delete({ id });
  }
}
