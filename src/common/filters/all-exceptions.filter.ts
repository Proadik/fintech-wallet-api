import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { STATUS_CODES } from 'node:http';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch (exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost
    const ctx = host.switchToHttp()

    const isHttp = exception instanceof HttpException
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    if (!isHttp) {
      this.logger.error(exception)
    }

    httpAdapter.reply(ctx.getResponse(), {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message: isHttp ? this.getMessage(exception) : 'Internal server error',
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    }, statusCode)
  }

  // ValidationPipe puts an array of messages in the response; join it so `message` is always a string
  private getMessage (exception: HttpException) {
    const response = exception.getResponse()

    if (typeof response === 'object' && response !== null && 'message' in response) {
      const { message } = response as { message: unknown }
      return Array.isArray(message) ? message.join(', ') : String(message)
    }

    return exception.message
  }
}
