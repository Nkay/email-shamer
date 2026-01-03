import { Module } from '@nestjs/common';
import { DnsServiceImpl } from './dns.service';

@Module({
  providers: [
    {
      provide: 'DnsService',
      useClass: DnsServiceImpl,
    },
  ],
  exports: ['DnsService'],
})
export class DnsModule {}