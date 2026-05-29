import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SECRET_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

export const DEFAULT_STATE = {
  tasks: [
    { id: 't0', text: 'Acabar curso Bruno',               cat: 'per', prio: 'h', done: false },
    { id: 't1', text: 'Set up Felipe OS Telegram bot',    cat: 'biz', prio: 'h', done: false },
    { id: 't2', text: 'Tiro video — delete',              cat: 'per', prio: 'm', done: false },
    { id: 't3', text: 'Research Profound ICP industries', cat: 'biz', prio: 'm', done: false },
    { id: 't4', text: 'Log weight + calories today',      cat: 'fit', prio: 'l', done: false },
  ],
  goals: {
    lt: [
      { id: 'lt0', text: 'Build and scale Bora to Series A' },
      { id: 'lt1', text: 'Financial, time and location freedom' },
      { id: 'lt2', text: 'Build dream physique — 85 kg lean' },
      { id: 'lt3', text: 'Deep spiritual practice daily' },
      { id: 'lt4', text: 'Meaningful relationships and presence' },
    ],
    wk: [
      { id: 'wk0', text: 'Ship Bora landing page v1' },
      { id: 'wk1', text: 'Book 3 discovery calls for Profound outreach' },
      { id: 'wk2', text: 'Hit the gym 5× this week' },
      { id: 'wk3', text: 'Set up Telegram bot + dashboard' },
    ],
    mo: [
      { id: 'mo0', text: 'Validate Bora with 10 fitness studios' },
      { id: 'mo1', text: 'Find 1 potential cofounder to explore' },
      { id: 'mo2', text: 'Gain 2 kg of lean mass' },
      { id: 'mo3', text: 'Read 1 book on enterprise sales' },
    ],
  },
  reminders: [
    { id: 'r0', text: 'Renew F1 visa',                       when: 'Urgent',        urgent: true },
    { id: 'r1', text: 'Open US bank account',                when: 'Before Jul 13', urgent: false },
    { id: 'r2', text: 'Msg Lucas Lameiras',                  when: 'Today',         urgent: false },
    { id: 'r3', text: 'Talk to Bocayuva + Nick Phillips',    when: 'Before Jul 13', urgent: false },
  ],
  habits: {
    h0: { name: 'Workout',    meta: 'Fitness · daily',   done: false },
    h1: { name: 'Meditate',   meta: 'Spiritual · daily', done: false },
    h2: { name: 'Prayer',     meta: 'Spiritual · daily', done: false },
    h3: { name: 'Log weight', meta: 'Health · daily',    done: false },
    h4: { name: 'Deep work',  meta: 'Profound · daily',  done: false },
    h5: { name: 'Bora work',  meta: 'Startup · daily',   done: false },
  },
};

export async function initState() {
  const { data } = await supabase.from('os_state').select('id').eq('id', 1).single();
  if (!data) {
    await supabase.from('os_state').insert({ id: 1, data: DEFAULT_STATE });
    console.log('OS state initialised with defaults.');
  }
}

export async function getState() {
  const { data, error } = await supabase
    .from('os_state').select('data').eq('id', 1).single();
  if (error || !data?.data || Object.keys(data.data).length === 0) return DEFAULT_STATE;
  return data.data;
}

export async function saveState(newState) {
  const { error } = await supabase
    .from('os_state')
    .upsert({ id: 1, data: newState, updated_at: new Date().toISOString() });
  if (error) throw error;
  return newState;
}

function fuzzyMatch(str, query) {
  return str.toLowerCase().includes(query.toLowerCase());
}

export async function applyPatch(patch) {
  const state = await getState();

  if (patch.add_task) {
    const { text, cat = 'per', prio = 'm' } = patch.add_task;
    state.tasks.push({ id: 't' + Date.now(), text, cat, prio, done: false });
  }

  if (patch.complete_task !== undefined) {
    const q = patch.complete_task;
    const t = state.tasks.find(t => t.id === q || fuzzyMatch(t.text, q));
    if (t) t.done = true;
  }

  if (patch.uncomplete_task !== undefined) {
    const q = patch.uncomplete_task;
    const t = state.tasks.find(t => t.id === q || fuzzyMatch(t.text, q));
    if (t) t.done = false;
  }

  if (patch.delete_task !== undefined) {
    const q = patch.delete_task;
    state.tasks = state.tasks.filter(t => t.id !== q && !fuzzyMatch(t.text, q));
  }

  if (patch.add_goal) {
    const { type, text } = patch.add_goal;
    if (state.goals[type]) {
      state.goals[type].push({ id: type + Date.now(), text });
    }
  }

  if (patch.delete_goal !== undefined) {
    const q = patch.delete_goal;
    for (const type of ['lt', 'wk', 'mo']) {
      state.goals[type] = state.goals[type].filter(
        g => g.id !== q && !fuzzyMatch(g.text, q)
      );
    }
  }

  if (patch.add_reminder) {
    const { text, when = '—', urgent = false } = patch.add_reminder;
    state.reminders.push({ id: 'r' + Date.now(), text, when, urgent });
  }

  if (patch.delete_reminder !== undefined) {
    const q = patch.delete_reminder;
    state.reminders = state.reminders.filter(
      r => r.id !== q && !fuzzyMatch(r.text, q)
    );
  }

  if (patch.mark_habit) {
    const { id, done } = patch.mark_habit;
    if (state.habits[id]) {
      state.habits[id].done = done;
    } else {
      // fuzzy match on habit name
      for (const [hid, habit] of Object.entries(state.habits)) {
        if (fuzzyMatch(habit.name, id)) { habit.done = done; break; }
      }
    }
  }

  if (patch.add_habit) {
    const { name, meta = '' } = patch.add_habit;
    const hid = 'h' + Date.now();
    state.habits[hid] = { name, meta, done: false };
  }

  if (patch.delete_habit !== undefined) {
    const q = patch.delete_habit;
    for (const hid of Object.keys(state.habits)) {
      if (hid === q || fuzzyMatch(state.habits[hid].name, q)) {
        delete state.habits[hid];
        break;
      }
    }
  }

  if (patch.reset_habits) {
    for (const h of Object.values(state.habits)) h.done = false;
  }

  return saveState(state);
}
