import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, WEBHOOK_URL } from './config.js';
import { parseIntent } from './claude.js';
import { transcribeVoice } from './voice.js';
import { getState, applyPatch } from './db.js';
import { broadcast } from './sse.js';

let chatId = TELEGRAM_CHAT_ID ? parseInt(TELEGRAM_CHAT_ID) : null;
export const getChatId = () => chatId;

export function createBot() {
  const usePolling = !WEBHOOK_URL;
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: usePolling, webHook: false });

  bot.on('message', async (msg) => {
    chatId = msg.chat.id;
    let text = null;

    if (msg.voice) {
      await bot.sendChatAction(chatId, 'typing');
      text = await transcribeVoice(bot, msg.voice.file_id).catch(() => null);
      if (!text) {
        await bot.sendMessage(chatId,
          '🎤 Voice received, but no OPENAI_API_KEY is set.\n' +
          'Add your OpenAI key to the .env to enable voice transcription.');
        return;
      }
      await bot.sendMessage(chatId, `_Heard: "${text}"_`, { parse_mode: 'Markdown' });
    } else if (msg.text) {
      text = msg.text.trim();
    }

    if (!text) return;

    if (text.startsWith('/')) {
      await handleCommand(bot, chatId, text);
      return;
    }

    try {
      await bot.sendChatAction(chatId, 'typing');
      const state  = await getState();
      const patch  = await parseIntent(text, state);

      if (patch.none) {
        await bot.sendMessage(chatId,
          "I didn't find a dashboard action there.\n\n" +
          "Try:\n• \"add task X\"\n• \"done workout\"\n• \"weekly goal: Y\"\n• \"remind me to Z\"\n• \"delete task X\"");
        return;
      }

      const newState = await applyPatch(patch);
      broadcast('state', newState);

      await bot.sendMessage(chatId, confirm(patch), { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Bot handler error:', err);
      await bot.sendMessage(chatId, '❌ Something went wrong. Try again.');
    }
  });

  bot.on('polling_error', err => console.error('Telegram polling error:', err.message));
  return bot;
}

async function handleCommand(bot, chatId, text) {
  const cmd = text.split(' ')[0].toLowerCase();
  if (cmd === '/reset') {
    const { applyPatch } = await import('./db.js');
    const state = await applyPatch({ reset_habits: true });
    broadcast('state', state);
    await bot.sendMessage(chatId, '🔄 All habits reset.');
  } else if (cmd === '/state') {
    const state = await getState();
    const done = Object.values(state.habits).filter(h => h.done).length;
    const total = Object.values(state.habits).length;
    const left = state.tasks.filter(t => !t.done).length;
    await bot.sendMessage(chatId,
      `📊 *Dashboard snapshot*\n` +
      `Habits: ${done}/${total} done\n` +
      `Tasks: ${left} remaining\n` +
      `Goals: ${state.goals.wk.length} weekly, ${state.goals.mo.length} monthly`,
      { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(chatId,
      'Commands:\n/reset — reset all habits\n/state — dashboard summary\n\nOr just talk naturally.');
  }
}

function confirm(patch) {
  const lines = [];
  if (patch.add_task)       lines.push(`✅ Task added: *${patch.add_task.text}*`);
  if (patch.complete_task)  lines.push(`✅ Task marked done.`);
  if (patch.uncomplete_task) lines.push(`↩️ Task unchecked.`);
  if (patch.delete_task)    lines.push(`🗑 Task removed.`);
  if (patch.add_goal) {
    const label = { lt: 'Long-term', wk: 'Weekly', mo: 'Monthly' }[patch.add_goal.type];
    lines.push(`✅ ${label} goal: *${patch.add_goal.text}*`);
  }
  if (patch.delete_goal)    lines.push(`🗑 Goal removed.`);
  if (patch.add_reminder)   lines.push(`🔔 Reminder: *${patch.add_reminder.text}* — ${patch.add_reminder.when}`);
  if (patch.delete_reminder) lines.push(`🗑 Reminder removed.`);
  if (patch.mark_habit) {
    lines.push(patch.mark_habit.done
      ? `✅ Habit done: *${patch.mark_habit.id}*`
      : `↩️ Habit unchecked: *${patch.mark_habit.id}*`);
  }
  if (patch.add_habit)      lines.push(`✅ Habit added: *${patch.add_habit.name}*`);
  if (patch.delete_habit)   lines.push(`🗑 Habit removed.`);
  if (patch.reset_habits)   lines.push(`🔄 All habits reset.`);
  return lines.join('\n') || '✅ Dashboard updated.';
}
