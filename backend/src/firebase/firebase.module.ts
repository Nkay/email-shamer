import { Module, Global } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { DomainRegistryService } from './domain-registry.service';
import { CacheModule } from '../cache/cache.module';

@Global()
@Module({
  imports: [CacheModule],
  providers: [FirebaseService, DomainRegistryService],
  exports: [FirebaseService, DomainRegistryService],
})
export class FirebaseModule {}