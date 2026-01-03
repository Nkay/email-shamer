import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "DMARC Portal Backend API"', () => {
      expect(appController.getHello()).toBe('DMARC Portal Backend API');
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });
});