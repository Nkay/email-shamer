import { Module } from '@nestjs/common';
import { DomainsController } from './domains.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { VotingModule } from '../voting/voting.module';
import { DmarcModule } from '../dmarc/dmarc.module';

@Module({
  imports: [FirebaseModule, VotingModule, DmarcModule],
  controllers: [DomainsController],
})
export class DomainsModule {}