import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DnsModule } from './dns/dns.module';
import { DmarcModule } from './dmarc/dmarc.module';

@Module({
  imports: [DnsModule, DmarcModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}