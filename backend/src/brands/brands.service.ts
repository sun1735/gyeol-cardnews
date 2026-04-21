import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { assertBrandOwnership } from '../auth/ownership'
import type { AuthUser } from '../auth/auth.service'

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  list() {
    // 조회는 현재 전부 공개 — AUTH_MODE=enabled 전환 시점에 ownerId 필터 추가 고려
    return this.prisma.brandProfile.findMany({
      include: { assets: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async get(id: string) {
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id },
      include: { assets: true },
    })
    if (!brand) throw new NotFoundException('brand not found')
    return brand
  }

  async create(data: any, user: AuthUser | null | undefined) {
    const { assets = [], ...rest } = data ?? {}
    return this.prisma.brandProfile.create({
      data: {
        // 토큰이 있으면 해당 유저를 owner 로 설정. 없으면 null (레거시)
        ownerId: user?.id ?? null,
        name: String(rest.name ?? ''),
        tone: String(rest.tone ?? ''),
        defaultPhrase: String(rest.defaultPhrase ?? ''),
        primaryColor: String(rest.primaryColor ?? '#0f766e'),
        secondaryColor: String(rest.secondaryColor ?? '#f0fdfa'),
        textColor: String(rest.textColor ?? '#111827'),
        fontFamily: String(rest.fontFamily ?? 'Pretendard, sans-serif'),
        assets: {
          create: (assets as any[]).map((a) => ({
            url: String(a.url),
            caption: String(a.caption ?? ''),
            kind: String(a.kind ?? 'image'),
          })),
        },
      },
      include: { assets: true },
    })
  }

  async update(id: string, data: any, user: AuthUser | null | undefined) {
    await assertBrandOwnership(this.prisma, id, user)
    const { assets, ...rest } = data ?? {}
    const updateData: Record<string, any> = {}
    for (const k of [
      'name', 'tone', 'defaultPhrase',
      'primaryColor', 'secondaryColor', 'textColor', 'fontFamily',
    ]) {
      if (rest[k] !== undefined) updateData[k] = String(rest[k])
    }
    await this.prisma.brandProfile.update({ where: { id }, data: updateData })
    if (Array.isArray(assets)) {
      await this.prisma.brandAsset.deleteMany({ where: { brandId: id } })
      await this.prisma.brandAsset.createMany({
        data: assets.map((a: any) => ({
          brandId: id,
          url: String(a.url),
          caption: String(a.caption ?? ''),
          kind: String(a.kind ?? 'image'),
        })),
      })
    }
    return this.get(id)
  }

  async remove(id: string, user: AuthUser | null | undefined) {
    await assertBrandOwnership(this.prisma, id, user)
    await this.prisma.brandProfile.delete({ where: { id } })
    return { ok: true }
  }
}
