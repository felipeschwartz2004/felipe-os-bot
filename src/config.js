import 'dotenv/config';

export const TELEGRAM_TOKEN   = process.env.TELEGRAM_TOKEN;
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const SUPABASE_URL      = process.env.SUPABASE_URL;
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
export const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
export const API_SECRET        = process.env.API_SECRET;
export const WEBHOOK_URL       = process.env.WEBHOOK_URL;
export const TELEGRAM_CHAT_ID  = process.env.TELEGRAM_CHAT_ID;
export const PORT              = parseInt(process.env.PORT || '3001', 10);
export const TIMEZONE          = process.env.TIMEZONE || 'America/Sao_Paulo';
