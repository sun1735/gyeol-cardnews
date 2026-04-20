import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.project.findMany({
      include: {
        cards: { orderBy: { order: 'asc' } },
        brand: { include: { assets: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async get(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        cards: { orderBy: { order: 'asc' } },
        brand: { include: { assets: true } },
      },
    })
    if (!project) throw new NotFoundException('project not found')
    return project
  }

  create(data: any) {
    const { cards = [], ...rest } = data ?? {}
    return this.prisma.project.create({
      data: {
        title: String(rest.title ?? ''),
        prompt: String(rest.prompt ?? ''),
        sizePreset: String(rest.sizePreset ?? '1:1'),
        inputMode: String(rest.inputMode ?? 'auto'),
        ...(rest.brandId
          ? { brand: { connect: { id: String(rest.brandId) } } }
          : {}),
        cards: {
          create: (cards as any[]).map((c, i) => ({
            order: Number.isFinite(c.order) ? c.order : i,
            title: String(c.title ?? ''),
            body: String(c.body ?? ''),
            subtext: String(c.subtext ?? ''),
            cta: String(c.cta ?? ''),
            imageUrl: c.imageUrl ? String(c.imageUrl) : null,
            layout: String(c.layout ?? 'content'),
          })),
        },
      },
      include: { cards: { orderBy: { order: 'asc' } } },
    })
  }

  async update(id: string, data: any) {
    const { cards, ...rest } = data ?? {}
    const updateData: Record<string, any> = {}
    if (rest.title !== undefined) updateData.title = String(rest.title)
    if (rest.prompt !== undefined) updateData.prompt = String(rest.prompt)
    if (rest.sizePreset !== undefined) updateData.sizePreset = String(rest.sizePreset)
    if (rest.inputMode !== undefined) updateData.inputMode = String(rest.inputMode)
    if (rest.brandId !== undefined) {
      updateData.brand = rest.brandId
        ? { connect: { id: String(rest.brandId) } }
        : { disconnect: true }
    }
    await this.prisma.project.update({ where: { id }, data: updateData })

    if (Array.isArray(cards)) {
      await this.prisma.card.deleteMany({ where: { projectId: id } })
      await this.prisma.card.createMany({
        data: cards.map((c: any, i: number) => ({
          projectId: id,
          order: Number.isFinite(c.order) ? c.order : i,
          title: String(c.title ?? ''),
          body: String(c.body ?? ''),
          subtext: String(c.subtext ?? ''),
          cta: String(c.cta ?? ''),
          imageUrl: c.imageUrl ? String(c.imageUrl) : null,
          layout: String(c.layout ?? 'content'),
        })),
      })
    }
    return this.get(id)
  }

  async remove(id: string) {
    await this.prisma.project.delete({ where: { id } })
    return { ok: true }
  }
}
