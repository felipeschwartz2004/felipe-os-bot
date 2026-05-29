import fetch from 'node-fetch';
import FormData from 'form-data';
import { OPENAI_API_KEY } from './config.js';

export async function transcribeVoice(bot, fileId) {
  if (!OPENAI_API_KEY) return null;

  const fileLink = await bot.getFileLink(fileId);
  const audioRes  = await fetch(fileLink);
  const audioBuf  = Buffer.from(await audioRes.arrayBuffer());

  const form = new FormData();
  form.append('file', audioBuf, { filename: 'voice.ogg', contentType: 'audio/ogg' });
  form.append('model', 'whisper-1');
  form.append('response_format', 'json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form,
  });

  if (!res.ok) throw new Error(`OpenAI Whisper ${res.status}: ${await res.text()}`);
  const { text } = await res.json();
  return text?.trim() || null;
}
