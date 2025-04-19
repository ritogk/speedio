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
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import {
  ApiTags,
  ApiQuery,
  ApiCreatedResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { Item } from './entities/item.entity';

@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

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
    type: [Item],
  })
  @Get()
  async findAll(
    @Query('minLatitude') minLatitude: number,
    @Query('minLongitude') minLongitude: number,
    @Query('maxLatitude') maxLatitude: number,
    @Query('maxLongitude') maxLongitude: number,
  ): Promise<Item[]> {
    return this.itemsService.findAll();
  }

  @ApiOkResponse({
    type: Item,
  })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Item> {
    return this.itemsService.findOne(+id);
  }

  @Post()
  @ApiBody({
    description: 'itemの登録',
    type: CreateItemDto,
  })
  @ApiCreatedResponse({
    type: Item,
  })
  async create(@Body() createItemDto: CreateItemDto): Promise<Item> {
    return this.itemsService.create(createItemDto);
  }

  @ApiBody({
    description: 'itemの更新',
    type: UpdateItemDto,
  })
  @ApiOkResponse({
    type: Item,
  })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
  ): Promise<Item> {
    await this.itemsService.update(+id, updateItemDto);
    return this.itemsService.findOne(+id);
  }

  @ApiOkResponse()
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.itemsService.remove(+id);
  }
}
