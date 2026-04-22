import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthService } from './auth.service'
import { AuthGuard } from './auth.guard'
import { AuthController } from './auth.controller'

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
