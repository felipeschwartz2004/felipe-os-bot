import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from './config.js';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const SYSTEM = `You are Felipe's personal OS assistant. He talks naturally — parse his message and return a JSON action to update his dashboard.

Return ONLY valid JSON, no markdown, no explanation.

Available action keys (use one or more in the same object):
  add_task        {text: string, cat: "biz"|"per"|"fit"|"pro", prio: "h"|"m"|"l"}
  complete_task   string  (task text or id to mark done)
  uncomplete_task string  (task text or id to uncheck)
  delete_task     string  (task text or id to remove)
  add_goal        {type: "lt"|"wk"|"mo", text: string}   lt=long-term wk=weekly mo=monthly
  delete_goal     string  (goal text or id)
  add_reminder    {text: string, when: string, urgent: boolean}
  delete_reminder string  (reminder text or id)
  mark_habit      {id: string, done: boolean}   id = h0-h5 OR habit name like "workout"
  add_habit       {name: string, meta: string}
  delete_habit    string  (habit name or id)
  reset_habits    true
  none            true    (message has nothing to do with dashboard)

Category guide: biz = Bora/Profound/work, per = personal, fit = health/fitness, pro = Profound

Examples:
"done workout"                         → {"mark_habit": {"id": "workout", "done": true}}
"finished meditation and prayer"       → {"mark_habit": {"id": "meditation", "done": true}}
"add task call investor tomorrow bora" → {"add_task": {"text": "Call investor tomorrow", "cat": "biz", "prio": "h"}}
"remind me to book dentist next week"  → {"add_reminder": {"text": "Book dentist", "when": "Next week", "urgent": false}}
"weekly goal: finish bora pitch deck"  → {"add_goal": {"type": "wk", "text": "Finish Bora pitch deck"}}
"remove the visa reminder"             → {"delete_reminder": "visa"}
"delete task log weight"               → {"delete_task": "log weight"}
"reset all habits"                     → {"reset_habits": true}
"whats up"                             → {"none": true}`;

export async function parseIntent(text, state) {
  const context = `Current state:
Tasks: ${state.tasks.map(t => `[${t.id}] "${t.text}" (${t.done ? 'done' : 'pending'})`).join(' | ')}
Habits: ${Object.entries(state.habits).map(([id, h]) => `[${id}] ${h.name} (${h.done ? 'done' : 'pending'})`).join(' | ')}
Reminders: ${state.reminders.map(r => `[${r.id}] "${r.text}"`).join(' | ')}
Goals wk: ${state.goals.wk.map(g => `[${g.id}] "${g.text}"`).join(' | ')}`;

  const { content } = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 512,
    system: SYSTEM,
    messages: [{ role: 'user', content: `${context}\n\nMessage: "${text}"` }],
  });

  return JSON.parse(content[0].text.trim());
}
