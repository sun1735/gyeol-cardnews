import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  list() {
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

  create(data: any) {
    const { assets = [], ...rest } = data ?? {}
    return this.prisma.brandProfile.create({
      data: {
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

  async update(id: string, data: any) {
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

  async remove(id: string) {
    await this.prisma.brandProfile.delete({ where: { id } })
    return { ok: true }
  }
}
