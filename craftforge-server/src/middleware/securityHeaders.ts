// 简易安全响应头中间件（替代 helmet，不增加依赖）
// - X-Content-Type-Options: nosniff
// - X-Frame-Options: SAMEORIGIN
// - Referrer-Policy: strict-origin-when-cross-origin
// - Permissions-Policy: 限制摄像头/麦克风（保留 microphone，因为 STT 需要）
// - Strict-Transport-Security：仅生产 HTTPS 时生效（通过 X-Forwarded-Proto 判断）
import { Request, Response, NextFunction } from 'express';

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)'
  );
  // 通过 Nginx 转发时 X-Forwarded-Proto = https，再加 HSTS（半年）
  if (req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}
