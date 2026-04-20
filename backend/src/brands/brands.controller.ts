import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { BrandsService } from './brands.service'

@Controller('api/brands')
export class BrandsController {
  constructor(private svc: BrandsService) {}

  @Get()
  async list() {
    const brands = await this.svc.list()
    return { brands }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const brand = await this.svc.get(id)
    return { brand }
  }

  @Post()
  async create(@Body() body: any) {
    const brand = await this.svc.create(body)
    return { brand }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const brand = await this.svc.update(id, body)
    return { brand }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }
}
