import { Module } from '@nestjs/common';
import { DmarcValidatorImpl } from './dmarc-validator.service';

@Module({
  providers: [
    {
      provide: 'DmarcValidator',
      useClass: DmarcValidatorImpl,
    },
  ],
  exports: ['DmarcValidator'],
})
export class DmarcModule {}