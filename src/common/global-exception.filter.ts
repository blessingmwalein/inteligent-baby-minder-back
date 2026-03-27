import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || 'Http Error';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Output generic JSON errors for Mobile applications
    response.status(status).json({
      success: false,
      statusCode: status,
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
}
