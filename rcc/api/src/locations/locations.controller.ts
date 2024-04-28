import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import {
  ApiTags,
  ApiQuery,
  ApiCreatedResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { Location } from './entities/location.entity';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @ApiOperation({
    summary: '位置情報の取得',
    description:
      'バウンディングボックスを指定している場合はその範囲内の位置情報を取得。',
  })
  @ApiQuery({
    name: 'minLatitude',
    required: false,
    type: Number,
    description: 'Minimum latitude of the bounding box',
  })
  @ApiQuery({
    name: 'minLongitude',
    required: false,
    type: Number,
    description: 'Minimum longitude of the bounding box',
  })
  @ApiQuery({
    name: 'maxLatitude',
    required: false,
    type: Number,
    description: 'Maximum latitude of the bounding box',
  })
  @ApiQuery({
    name: 'maxLongitude',
    required: false,
    type: Number,
    description: 'Maximum longitude of the bounding box',
  })
  @ApiOkResponse({
    type: [Location],
  })
  @Get()
  async findAll(
    @Query('minLatitude') minLatitude: number,
    @Query('minLongitude') minLongitude: number,
    @Query('maxLatitude') maxLatitude: number,
    @Query('maxLongitude') maxLongitude: number,
  ): Promise<Location[]> {
    return this.locationsService.findAll(
      minLatitude,
      minLongitude,
      maxLatitude,
      maxLongitude,
    );
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
