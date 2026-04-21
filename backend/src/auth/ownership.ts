// 브랜드 소유권 검증 헬퍼 — 모든 브랜드 파생 리소스(지식노트·이미지·아이디어·프로젝트·카드·
// 생성 잡) 의 mutation 전에 호출한다. 토큰이 없거나 브랜드가 ownerless(null) 면 통과
// (마이그레이션 기간 레거시 데이터 호환).

import { ForbiddenException, NotFoundException } from '@nestjs/common'
import type { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from './auth.service'

export async function assertBrandOwnership(
  prisma: PrismaService,
  brandId: string,
  user: AuthUser | null | undefined,
): Promise<void> {
  // 인증 모드 OFF 또는 토큰 없음 → 레거시 동작 유지
  if (!user) return

  const brand = await prisma.brandProfile.findUnique({
    where: { id: brandId },
    select: { ownerId: true },
  })
  if (!brand) throw new NotFoundException('brand not found')

  // ownerless (null) = 레거시/시드 브랜드 → 누구든 수정 허용 (AUTH_MODE 도입 전 데이터 호환)
  if (brand.ownerId === null) return
  if (brand.ownerId !== user.id) {
    throw new ForbiddenException('이 브랜드에 대한 권한이 없습니다')
  }
}
