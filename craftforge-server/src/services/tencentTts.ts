// 腾讯云 TTS（文本转语音）服务
// - 采用 TC3-HMAC-SHA256 鉴权（最新签名版本 v3）
// - 调用接口：TextToVoice（tts.tencentcloudapi.com）
// - 启用 EnableSubtitle 返回字级时间戳，用于前端嘴型同步
// 文档：https://cloud.tencent.com/document/api/1073/37995
import crypto from 'crypto';

const SERVICE = 'tts';
const HOST = 'tts.tencentcloudapi.com';
const VERSION = '2019-08-23';
const ACTION = 'TextToVoice';

/** 单个字/词的时间戳（毫秒） */
export interface SubtitlePiece {
  Text: string;        // 该片段对应的文字
  BeginTime: number;   // 开始时间（毫秒）
  EndTime: number;     // 结束时间（毫秒）
  StableIndex?: number;
  PhoneBeginTime?: number;
  PhoneEndTime?: number;
}

/** TTS 合成返回 */
export interface TtsResult {
  audio: string;              // base64 编码的音频
  subtitles: SubtitlePiece[]; // 字级时间戳数组
  sessionId: string;
}

/** sha256 十六进制摘要 */
function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** hmac-sha256 原始 Buffer */
function hmacSha256(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

/**
 * 生成 TC3-HMAC-SHA256 Authorization 头
 * 严格按照官方步骤：拼接规范请求 -> 签名串 -> 签名 -> 鉴权头
 */
function buildAuthorization(opts: {
  secretId: string;
  secretKey: string;
  payload: string;
  timestamp: number;
}): string {
  const { secretId, secretKey, payload, timestamp } = opts;
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  // 1) 规范请求串
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\n` +
    `host:${HOST}\n` +
    `x-tc-action:${ACTION.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedRequestPayload = sha256Hex(payload);
  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload,
  ].join('\n');

  // 2) 待签名串
  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const hashedCanonicalRequest = sha256Hex(canonicalRequest);
  const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonicalRequest].join('\n');

  // 3) 派生签名密钥并计算签名
  const secretDate = hmacSha256('TC3' + secretKey, date);
  const secretService = hmacSha256(secretDate, SERVICE);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign, 'utf8').digest('hex');

  // 4) 拼接 Authorization
  return `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

/**
 * 调用腾讯云 TTS 合成语音
 * @param text 待合成文本，单次建议 ≤150 字
 */
export async function synthesizeVoice(text: string): Promise<TtsResult> {
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  const region = process.env.TENCENT_REGION || 'ap-guangzhou';
  const voiceType = Number(process.env.TENCENT_VOICE_TYPE || 1003);
  const sampleRate = Number(process.env.TENCENT_SAMPLE_RATE || 16000);
  const speed = Number(process.env.TENCENT_VOICE_SPEED || 0);  // -2~2，0 为默认速度
  const volume = Number(process.env.TENCENT_VOICE_VOLUME || 0); // -10~10，0 为默认音量

  if (!secretId || !secretKey) {
    throw new Error('TENCENT_SECRET_ID / TENCENT_SECRET_KEY 未配置');
  }

  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) throw new Error('text 不能为空');
  if (trimmed.length > 150) {
    // 单次合成限制（普通音色 150 字），超长由前端切句
    throw new Error('text 长度超过 150 字，请前端切句后再调用');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const sessionId = `cf-${timestamp}-${Math.random().toString(36).slice(2, 10)}`;

  const body = {
    Text: trimmed,
    SessionId: sessionId,
    VoiceType: voiceType,
    Codec: 'mp3',
    SampleRate: sampleRate,
    Speed: speed,
    Volume: volume,
    EnableSubtitle: true, // 返回字级时间戳
  };
  const payload = JSON.stringify(body);

  const authorization = buildAuthorization({ secretId, secretKey, payload, timestamp });

  const resp = await fetch(`https://${HOST}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Host: HOST,
      Authorization: authorization,
      'X-TC-Action': ACTION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': VERSION,
      'X-TC-Region': region,
    },
    body: payload,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`腾讯云 TTS HTTP ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await resp.json()) as {
    Response?: {
      Audio?: string;
      SessionId?: string;
      Subtitle?: SubtitlePiece[];
      Error?: { Code: string; Message: string };
      RequestId?: string;
    };
  };

  const r = json.Response;
  if (!r) throw new Error('腾讯云 TTS 返回结构异常');
  if (r.Error) throw new Error(`腾讯云 TTS [${r.Error.Code}] ${r.Error.Message}`);
  if (!r.Audio) throw new Error('腾讯云 TTS 未返回音频');

  return {
    audio: r.Audio,
    subtitles: r.Subtitle || [],
    sessionId: r.SessionId || sessionId,
  };
}
