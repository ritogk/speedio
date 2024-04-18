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
  findAll(): Location[] {
    // return this.locationsService.findAll();
    return [];
  }

  @ApiOkResponse({
    type: Location,
  })
  @Get(':id')
  findOne(@Param('id') id: string): Location {
    return this.locationsService.findOne(+id) as any;
  }

  @Post()
  @ApiBody({
    description: 'locationの登録',
    type: CreateLocationDto,
  })
  @ApiCreatedResponse({
    type: Location,
  })
  create(@Body() createLocationDto: CreateLocationDto) {
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
