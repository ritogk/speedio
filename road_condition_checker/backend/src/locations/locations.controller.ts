import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Location } from './entities/location.entity';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @ApiOkResponse({
    type: [Location],
  })
  @Get()
  async findAll(): Promise<Location[]> {
    return this.locationsService.findAll();
  }

  @ApiOkResponse({
    type: Location,
  })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Location> {
    return this.locationsService.findOne(+id);
  }

  @Post()
  @ApiBody({
    description: 'locationの登録',
    type: CreateLocationDto,
  })
  @ApiCreatedResponse({
    type: Location,
  })
  async create(
    @Body() createLocationDto: CreateLocationDto,
  ): Promise<Location> {
    return this.locationsService.create(createLocationDto);
  }

  @ApiBody({
    description: 'locationの更新',
    type: UpdateLocationDto,
  })
  @ApiOkResponse({
    type: Location,
  })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ): Promise<Location> {
    await this.locationsService.update(+id, updateLocationDto);
    return this.locationsService.findOne(+id);
  }

  @ApiOkResponse()
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.locationsService.remove(+id);
  }
}
