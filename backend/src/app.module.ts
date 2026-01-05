import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DnsModule } from './dns/dns.module';
import { DmarcModule } from './dmarc/dmarc.module';
import { FirebaseModule } from './firebase/firebase.module';
import { VotingModule } from './voting/voting.module';
import { DomainsModule } from './domains/domains.module';

@Module({
  imports: [DnsModule, DmarcModule, FirebaseModule, VotingModule, DomainsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}