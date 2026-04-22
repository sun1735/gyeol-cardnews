import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { CurrentUser, Public } from './auth.guard'
import { AuthUser } from './auth.service'

// 이메일·비밀번호 인증 엔드포인트.
// 프론트 Next.js 에서 호출 — CredentialsProvider.authorize() 와 /signup 플로우.
// 관리자(ADMIN_EMAILS 환경변수 매칭) 는 가입/로그인 시 role='admin' 자동 승격.

interface RegisterDto {
  email?: string
  password?: string
  name?: string
}
interface VerifyDto {
  email?: string
  password?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BCRYPT_ROUNDS = 10

// 관리자 이메일 — 코드 레벨 고정 목록 + ADMIN_EMAILS 환경변수 병합.
const HARDCODED_ADMIN_EMAILS = ['sun17351735@gmail.com']

function isAdminEmail(email: string): boolean {
  const envList = (process.env.ADMIN_EMAILS ?? '')
    .split(/[,\s]+/)
    .filter(Boolean)
  const all = [...HARDCODED_ADMIN_EMAILS, ...envList].map((s) => s.toLowerCase())
  return all.includes(email.toLowerCase())
}

// 경로가 NextAuth /api/auth/* 와 충돌하지 않도록 account 네임스페이스 사용.
// register/verify 는 Public, me 는 AuthGuard 필요.
@Controller('api/account')
export class AuthController {
  constructor(private prisma: PrismaService) {}

  // 회원가입. 비밀번호 해시 후 User 생성. 중복 이메일은 409.
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const email = (dto.email ?? '').trim().toLowerCase()
    const password = dto.password ?? ''
    const name = (dto.name ?? '').trim().slice(0, 40)

    if (!EMAIL_RE.test(email)) {
      throw new HttpException('이메일 형식이 올바르지 않습니다', HttpStatus.BAD_REQUEST)
    }
    if (password.length < 8) {
      throw new HttpException('비밀번호는 8자 이상이어야 합니다', HttpStatus.BAD_REQUEST)
    }
    if (password.length > 128) {
      throw new HttpException('비밀번호가 너무 깁니다', HttpStatus.BAD_REQUEST)
    }

    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      // 기존 소셜 계정이 이미 있는 경우에도 동일 응답(이메일로 분기는 정책 단순화)
      throw new HttpException('이미 가입된 이메일입니다', HttpStatus.CONFLICT)
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const role = isAdminEmail(email) ? 'admin' : 'user'
    const user = await this.prisma.user.create({
      data: { email, name, passwordHash, role },
    })
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }
  }

  // 로그인 검증. CredentialsProvider.authorize() 에서 호출.
  // 성공 시 user 객체 반환, 실패 시 401.
  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyDto) {
    const email = (dto.email ?? '').trim().toLowerCase()
    const password = dto.password ?? ''
    if (!email || !password) {
      throw new HttpException('이메일·비밀번호 필수', HttpStatus.BAD_REQUEST)
    }
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      throw new HttpException('이메일 또는 비밀번호가 올바르지 않습니다', HttpStatus.UNAUTHORIZED)
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      throw new HttpException('이메일 또는 비밀번호가 올바르지 않습니다', HttpStatus.UNAUTHORIZED)
    }
    // ADMIN_EMAILS 에 포함된 이메일은 로그인 시에도 admin 으로 동기화.
    if (isAdminEmail(user.email) && user.role !== 'admin') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: 'admin' },
      })
      user.role = 'admin'
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.imageUrl,
      role: user.role,
    }
  }

  // 현재 로그인 유저의 role·plan 조회. AuthGuard 가 req.user 를 채우고 ADMIN_EMAILS 자동 승격.
  // NextAuth jwt 콜백이 OAuth 첫 로그인 직후 호출해 role 을 세션에 반영.
  @Get('me')
  async me(@CurrentUser() user: AuthUser | null) {
    if (!user) throw new UnauthorizedException('로그인이 필요합니다')
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, name: true, role: true, plan: true, imageUrl: true },
    })
    if (!row) throw new UnauthorizedException()
    return row
  }
}
