import { PartialType } from '@nestjs/swagger'
import { CreateProjectDto } from './create-project.dto'

// 모든 필드를 선택 사항으로 만든다 (class-validator 메타데이터 + Swagger 메타데이터 모두 계승).
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
