import type { MailItem, MailAttachment } from './types';
import { uid } from './storage';

const KEY = 'recruitment_ats_mailbox_v1';

export function loadMail(): MailItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MailItem[];
  } catch {
    return [];
  }
}

export function saveMail(items: MailItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

export function upsertMail(item: MailItem) {
  const list = loadMail();
  const idx = list.findIndex((m) => m.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  saveMail(list);
}

export function deleteMail(id: string) {
  saveMail(loadMail().filter((m) => m.id !== id));
}

// ─── Convert MailAttachment ↔ File ────────────────────────────────

export async function fileToAttachment(file: File): Promise<MailAttachment> {
  const buf = await file.arrayBuffer();
  return {
    filename: file.name,
    mime: file.type || guessMime(file.name),
    data: arrayBufferToBase64(buf),
    sizeBytes: file.size
  };
}

export function attachmentToFile(a: MailAttachment): File {
  const bytes = base64ToBytes(a.data);
  // Wrap in a real ArrayBuffer to keep TS happy across lib versions
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  return new File([buf], a.filename, { type: a.mime || guessMime(a.filename) });
}

export function isResumeAttachment(a: MailAttachment): boolean {
  const ext = (a.filename.split('.').pop() || '').toLowerCase();
  return ['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext);
}

function guessMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt': return 'text/plain';
    case 'rtf': return 'application/rtf';
    case 'eml': return 'message/rfc822';
    default: return 'application/octet-stream';
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── Minimal RFC 822 / MIME parser ─────────────────────────────────
// Handles: headers, single body, multipart/* (one level of nesting),
// base64 + quoted-printable encodings, text/plain + text/html, attachments.

export interface ParsedEml {
  fromName: string;
  fromEmail: string;
  subject: string;
  receivedAt: string;
  body: string;
  attachments: MailAttachment[];
}

export async function parseEmlFile(file: File): Promise<ParsedEml> {
  const text = await file.text();
  return parseEml(text);
}

export function parseEml(raw: string): ParsedEml {
  const { headers, body, headerEnd } = splitHeadersBody(raw);
  void headerEnd;

  const contentType = (headers['content-type'] || 'text/plain').toLowerCase();
  const subject = decodeMimeWord(headers['subject'] || '(no subject)');
  const from = parseAddress(headers['from'] || '');
  const date = headers['date'] ? new Date(headers['date']).toISOString() : new Date().toISOString();

  let bodyText = '';
  const attachments: MailAttachment[] = [];

  if (contentType.startsWith('multipart/')) {
    const boundary = matchParam(contentType, 'boundary');
    if (boundary) {
      const parts = splitMultipart(body, boundary);
      for (const part of parts) {
        const inner = splitHeadersBody(part);
        const innerCt = (inner.headers['content-type'] || 'text/plain').toLowerCase();
        const disp = (inner.headers['content-disposition'] || '').toLowerCase();
        const transferEnc = (inner.headers['content-transfer-encoding'] || '').toLowerCase().trim();
        const isAttachment = disp.startsWith('attachment') || /name=/i.test(inner.headers['content-type'] || '');
        if (innerCt.startsWith('multipart/')) {
          // Nested multipart — flatten one level by recursing on body
          const nested = parseEml(part);
          if (!bodyText) bodyText = nested.body;
          attachments.push(...nested.attachments);
          continue;
        }
        if (isAttachment) {
          const filename = matchParam(disp, 'filename') || matchParam(inner.headers['content-type'] || '', 'name') || 'attachment';
          const mime = innerCt.split(';')[0].trim() || 'application/octet-stream';
          const data = decodeAttachmentBody(inner.body, transferEnc);
          attachments.push({
            filename: decodeMimeWord(filename),
            mime,
            data,
            sizeBytes: Math.ceil(data.length * 0.75)
          });
        } else if (innerCt.startsWith('text/')) {
          const decoded = decodeTextBody(inner.body, transferEnc, matchParam(innerCt, 'charset') || 'utf-8');
          if (!bodyText || innerCt.startsWith('text/plain')) {
            bodyText = decoded;
          }
        }
      }
    } else {
      bodyText = body;
    }
  } else {
    const transferEnc = (headers['content-transfer-encoding'] || '').toLowerCase().trim();
    bodyText = decodeTextBody(body, transferEnc, matchParam(contentType, 'charset') || 'utf-8');
  }

  return {
    fromName: from.name,
    fromEmail: from.email,
    subject,
    receivedAt: date,
    body: bodyText.trim().slice(0, 20000),
    attachments
  };
}

function splitHeadersBody(raw: string): { headers: Record<string, string>; body: string; headerEnd: number } {
  // Normalize line endings
  const s = raw.replace(/\r\n/g, '\n');
  const idx = s.indexOf('\n\n');
  if (idx < 0) return { headers: {}, body: s, headerEnd: -1 };
  const headerBlock = s.slice(0, idx);
  const body = s.slice(idx + 2);
  // Unfold continuation lines (RFC 822 §3.1.1)
  const unfolded = headerBlock.replace(/\n[ \t]+/g, ' ');
  const headers: Record<string, string> = {};
  for (const line of unfolded.split('\n')) {
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) {
      const k = m[1].toLowerCase();
      headers[k] = (headers[k] ? headers[k] + ' ' : '') + m[2];
    }
  }
  return { headers, body, headerEnd: idx };
}

function matchParam(s: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i');
  const m = s.match(re);
  return m ? (m[1] || m[2]) : undefined;
}

function parseAddress(s: string): { name: string; email: string } {
  const m = s.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>/);
  if (m) return { name: decodeMimeWord(m[1] || '').trim(), email: m[2].trim() };
  const e = s.match(/[\w.+-]+@[\w.-]+/);
  return { name: '', email: e ? e[0] : '' };
}

function splitMultipart(body: string, boundary: string): string[] {
  const sep = '--' + boundary;
  const parts: string[] = [];
  const lines = body.split('\n');
  let buf: string[] = [];
  let inPart = false;
  for (const ln of lines) {
    if (ln.startsWith(sep)) {
      if (inPart) parts.push(buf.join('\n'));
      if (ln.startsWith(sep + '--')) break;
      buf = [];
      inPart = true;
      continue;
    }
    if (inPart) buf.push(ln);
  }
  return parts;
}

function decodeAttachmentBody(body: string, enc: string): string {
  if (enc === 'base64') return body.replace(/[\s\r\n]+/g, '');
  if (enc === 'quoted-printable') return arrayBufferToBase64(stringToBuffer(decodeQuotedPrintable(body)));
  // 7bit/8bit/binary → re-encode as base64 so we can store uniformly
  return arrayBufferToBase64(stringToBuffer(body));
}

function decodeTextBody(body: string, enc: string, _charset: string): string {
  if (enc === 'base64') {
    try { return new TextDecoder().decode(stringToBytes(atob(body.replace(/[\s\r\n]+/g, '')))); } catch { return body; }
  }
  if (enc === 'quoted-printable') return decodeQuotedPrintable(body);
  return body;
}

function decodeQuotedPrintable(s: string): string {
  return s
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
}

function stringToBuffer(s: string): ArrayBuffer {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out.buffer;
}
function stringToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function decodeMimeWord(s: string): string {
  // =?charset?Q?text?= or =?charset?B?base64?=
  return s.replace(/=\?([^?]+)\?([QqBb])\?([^?]+)\?=/g, (_m, _cs, enc, data) => {
    try {
      if (enc.toUpperCase() === 'B') return new TextDecoder().decode(stringToBytes(atob(data)));
      return decodeQuotedPrintable(data.replace(/_/g, ' '));
    } catch { return data; }
  });
}
