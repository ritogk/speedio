import { Controller, Get, Param, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';

@Controller('review')
export class ReviewController {
  @Get(':prefCode')
  getReview(@Param('prefCode') prefCode: string, @Res() res: Response) {
    const filePath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      'data',
      'targets',
      prefCode,
      'review.csv',
    );
    if (!existsSync(filePath)) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ message: 'Review file not found' });
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.sendFile(filePath);
  }
}
