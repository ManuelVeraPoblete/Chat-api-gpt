// src/modules/workday/workday.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WorkdayController } from './workday.controller';
import { WorkdayService } from './workday.service';
import { Workday, WorkdaySchema } from './schemas/workday.schema';

/**
 *  WorkdayModule
 * - Persistencia Mongo (Mongoose)
 * - API protegida por JWT (guard a nivel controller)
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Workday.name, schema: WorkdaySchema }])],
  controllers: [WorkdayController],
  providers: [WorkdayService],
  exports: [WorkdayService],
})
export class WorkdayModule {}
