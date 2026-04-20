import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1) 유순 브랜드 upsert (이름 유니크)
  const existingBrand = await prisma.brandProfile.findUnique({
    where: { name: '유순' },
    include: { assets: true },
  })

  let brand
  if (existingBrand) {
    brand = existingBrand
    console.log('• Brand 이미 존재:', brand.name)
  } else {
    brand = await prisma.brandProfile.create({
      data: {
        name: '유순',
        tone: '따뜻하고 진솔한 · 시니어·가족을 배려하는 안심감 있는 어조',
        defaultPhrase: '오늘도 평안한 하루',
        primaryColor: '#6b8e4e',
        secondaryColor: '#f4f1e8',
        textColor: '#2d2a24',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        assets: {
          create: [
            { url: '/uploads/seed/yusoon-morning.svg', caption: '아침 산책', kind: 'image' },
            { url: '/uploads/seed/yusoon-meal.svg',    caption: '식사 시간', kind: 'image' },
            { url: '/uploads/seed/yusoon-program.svg', caption: '프로그램 활동', kind: 'image' },
          ],
        },
      },
      include: { assets: true },
    })
    console.log('✓ Brand seeded:', brand.name, `(${brand.assets.length} assets)`)
  }

  // 2) 샘플 프로젝트 (단계 4: subtext / cta 포함)
  const existingProject = await prisma.project.findFirst({
    where: { brandId: brand.id, title: '유순 하루 일과 소개' },
  })
  if (existingProject) {
    console.log('• Project 이미 존재:', existingProject.title)
    return
  }

  const project = await prisma.project.create({
    data: {
      brand: { connect: { id: brand.id } },
      title: '유순 하루 일과 소개',
      prompt:
        '유순 요양원의 따뜻한 하루: 아침 산책, 영양 식단, 정서 프로그램을 시니어 가족에게 전하는 카드뉴스',
      sizePreset: '1:1',
      inputMode: 'auto',
      cards: {
        create: [
          {
            order: 0, layout: 'cover',
            title: '유순 · 오늘도 평안한 하루',
            body: '가족처럼 곁에서 돌보는 유순의 하루를 소개합니다.',
            subtext: '유순 · 시니어 케어',
            cta: '하루 보기 →',
            imageUrl: '/uploads/seed/yusoon-morning.svg',
          },
          {
            order: 1, layout: 'content',
            title: '아침 산책',
            body: '햇살 좋은 정원에서 시작하는 느린 산책으로 하루를 엽니다.',
            subtext: '하루의 시작',
            cta: '2 / 5',
            imageUrl: '/uploads/seed/yusoon-morning.svg',
          },
          {
            order: 2, layout: 'content',
            title: '영양 식단',
            body: '영양사가 함께 설계한 부드럽고 균형 잡힌 식사를 준비합니다.',
            subtext: '점심 · 저녁',
            cta: '3 / 5',
            imageUrl: '/uploads/seed/yusoon-meal.svg',
          },
          {
            order: 3, layout: 'content',
            title: '정서 프로그램',
            body: '노래, 그림, 원예 등 취향에 맞춘 활동으로 오후를 채웁니다.',
            subtext: '오후 활동',
            cta: '4 / 5',
            imageUrl: '/uploads/seed/yusoon-program.svg',
          },
          {
            order: 4, layout: 'cta',
            title: '오늘도 평안한 하루',
            body: '가족처럼 돌보는 유순의 이야기를 더 듣고 싶다면 문의해 주세요.',
            subtext: '유순 드림',
            cta: '상담 문의 →',
          },
        ],
      },
    },
    include: { cards: true },
  })
  console.log('✓ Project seeded:', project.title, `(${project.cards.length} cards)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
