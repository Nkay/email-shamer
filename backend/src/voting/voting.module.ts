import { Module } from '@nestjs/common';
import { IpBlockerService } from './ip-blocker.service';

@Module({
  providers: [IpBlockerService],
  exports: [IpBlockerService],
})
export class VotingModule {}