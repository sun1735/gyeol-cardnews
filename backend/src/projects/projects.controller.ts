import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ProjectsService } from './projects.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'

@ApiTags('projects')
@Controller('api/projects')
export class ProjectsController {
  constructor(private svc: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: '프로젝트 목록 (최신순)' })
  async list() {
    const projects = await this.svc.list()
    return { projects }
  }

  @Get(':id')
  @ApiOperation({ summary: '프로젝트 상세 (카드·브랜드 포함)' })
  @ApiParam({ name: 'id', description: '프로젝트 CUID' })
  async get(@Param('id') id: string) {
    const project = await this.svc.get(id)
    return { project }
  }

  @Post()
  @ApiOperation({ summary: '프로젝트 생성 (카드 동시 생성 가능)' })
  async create(@Body() body: CreateProjectDto) {
    const project = await this.svc.create(body)
    return { project }
  }

  @Patch(':id')
  @ApiOperation({
    summary: '프로젝트 업데이트',
    description: 'cards 필드를 전달하면 해당 프로젝트의 카드를 전체 교체합니다. 단건 수정은 PUT /api/cards/:id 사용.',
  })
  async update(@Param('id') id: string, @Body() body: UpdateProjectDto) {
    const project = await this.svc.update(id, body)
    return { project }
  }

  @Delete(':id')
  @ApiOperation({ summary: '프로젝트 삭제 (카드 cascade 삭제)' })
  async remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }
}
