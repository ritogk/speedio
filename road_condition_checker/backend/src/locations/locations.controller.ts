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
import { LocationDto } from './dto/location.dto';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @ApiOkResponse({
    type: [LocationDto],
  })
  @Get()
  findAll(): LocationDto[] {
    // return this.locationsService.findAll();
    return [];
  }

  @ApiOkResponse({
    type: LocationDto,
  })
  @Get(':id')
  findOne(@Param('id') id: string): LocationDto {
    return this.locationsService.findOne(+id) as any;
  }

  @Post()
  @ApiBody({
    description: 'locationの登録',
    type: CreateLocationDto,
  })
  @ApiCreatedResponse({
    type: LocationDto,
  })
  create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.create(createLocationDto);
  }

  @ApiBody({
    description: 'locationの更新',
    type: UpdateLocationDto,
  })
  @ApiOkResponse({
    type: LocationDto,
  })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return this.locationsService.update(+id, updateLocationDto);
  }

  @ApiOkResponse()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.locationsService.remove(+id);
  }
}
