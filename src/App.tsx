import { useEffect, useState } from 'react';
import {
  Activity, ArrowUpRight, Bot, Check, CheckCheck, ChevronRight,
  Clock3, Home, LayoutDashboard, ListTodo, MessageCircle, Plus,
  Send, Settings2, Sparkles, Thermometer, Trash2, Waves,
  CalendarDays, Bell, Lightbulb, Fan, Zap, Menu, X, Circle,
} from 'lucide-react';
import './index.css';

type Task = { id: number; title: string; priority: string; done: boolean };
type Reminder = { id: number; title: string; time: string };
type Device = { id: string; name: string; room: string; on: boolean; icon: string };

const initialTasks: Task[] = [
  { id: 1, title: 'Complete data science assignment', priority: 'High', done: false },
  { id: 2, title: 'Review project documentation', priority: 'Medium', done: false },
  { id: 3, title: 'Read 20 pages', priority: 'Low', done: true },
];

const initialReminders: Reminder[] = [
  { id: 1, title: 'Review today’s priorities', time: 'Today · 6:00 PM' },
  { id: 2, title: 'Plan tomorrow’s schedule', time: 'Today · 8:00 PM' },
];

const initialDevices: Device[] = [
  { id: 'living', name: 'Living room lights', room: 'Living room', on: true, icon: 'light' },
  { id: 'bedroom', name: 'Bedroom lights', room: 'Bedroom', on: false, icon: 'light' },
  { id: 'fan', name: 'Smart fan', room: 'Living room', on: false, icon: 'fan' },
  { id: 'thermo', name: 'Thermostat', room: 'Climate control', on: true, icon: 'thermo' },
];

const readStore = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

type Section = 'Overview' | 'AI Assistant' | 'My Tasks' | 'Reminders' | 'Daily Planner' | 'Smart Home' | 'Activity History';

export default function App() {
  const [section, setSection] = useState<Section>('Overview');
  const [tasks, setTasks] = useState<Task[]>(() => readStore('lifeos-tasks', initialTasks));
  const [reminders, setReminders] = useState<Reminder[]>(() => readStore('lifeos-reminders', initialReminders));
  const [devices, setDevices] = useState<Device[]>(() => readStore('lifeos-devices', initialDevices));
  const [history, setHistory] = useState<string[]>(() => readStore('lifeos-history', ['LifeOS workspace initialized']));
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: 'assistant', text: 'Hi! I’m your LifeOS assistant. I can organize tasks, prepare a daily plan, create reminders and control your simulated smart home. What would you like to do?' },
  ]);
  const [input, setInput] = useState('');
  const [newTask, setNewTask] = useState('');
  const [newReminder, setNewReminder] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);

  // Load saved workspace data from the Express API / SQLite database.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [taskRes, reminderRes, deviceRes, activityRes] = await Promise.all([
          fetch('/api/tasks'), fetch('/api/reminders'), fetch('/api/devices'), fetch('/api/activity'),
        ]);
        if (!active) return;
        if (taskRes.ok) {
          const rows = await taskRes.json();
          if (Array.isArray(rows)) setTasks(rows.map((t: any) => ({ id: Number(t.id), title: t.title, priority: t.priority || 'Medium', done: t.done === true || t.done === 1 || t.done === '1' || t.done === 'true' })));
        }
        if (reminderRes.ok) {
          const rows = await reminderRes.json();
          if (Array.isArray(rows)) setReminders(rows.map((r: any) => ({ id: Number(r.id), title: r.title, time: r.due_at || r.time || 'No time set' })));
        }
        if (deviceRes.ok) {
          const rows = await deviceRes.json();
          if (Array.isArray(rows)) setDevices(rows.map((d: any) => ({ id: String(d.id), name: d.name, room: d.room || 'Home', on: (d.is_on ?? d.on) === true || (d.is_on ?? d.on) === 1 || (d.is_on ?? d.on) === '1' || (d.is_on ?? d.on) === 'true', icon: String(d.type || d.icon || 'light').toLowerCase() })));
        }
        if (activityRes.ok) {
          const rows = await activityRes.json();
          if (Array.isArray(rows) && rows.length) setHistory(rows.map((a: any) => `${a.action || 'Activity'}${a.details ? `: ${a.details}` : ''}`));
        }
      } catch (error) {
        console.warn('LifeOS API is unavailable; keeping browser-saved data.', error);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => { try { localStorage.setItem('lifeos-tasks', JSON.stringify(tasks)); } catch (error) { console.warn('Could not save tasks in browser storage.', error); } }, [tasks]);
  useEffect(() => { try { localStorage.setItem('lifeos-reminders', JSON.stringify(reminders)); } catch (error) { console.warn('Could not save reminders in browser storage.', error); } }, [reminders]);
  useEffect(() => { try { localStorage.setItem('lifeos-devices', JSON.stringify(devices)); } catch (error) { console.warn('Could not save devices in browser storage.', error); } }, [devices]);
  useEffect(() => { try { localStorage.setItem('lifeos-history', JSON.stringify(history)); } catch (error) { console.warn('Could not save activity history in browser storage.', error); } }, [history]);

  const log = (text: string) => setHistory(old => [text, ...old].slice(0, 50));
  const addTask = (title: string) => {
    if (!title.trim()) return false;
    const cleanTitle = title.trim();
    const temporaryId = Date.now();
    setTasks(old => [{ id: temporaryId, title: cleanTitle, priority: 'Medium', done: false }, ...old]);
    log(`Task created: ${cleanTitle}`);
    void fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: cleanTitle, priority: 'Medium' }) })
      .then(async res => { if (!res.ok) throw new Error('Task API request failed'); const saved = await res.json(); if (saved?.id != null) setTasks(old => old.map(t => t.id === temporaryId ? { ...t, id: Number(saved.id) } : t)); })
      .catch(error => console.warn('Task was added locally but not saved to the API.', error));
    return true;
  };
  const addReminder = (title: string, time: string) => {
    if (!title.trim() || !time) return false;
    const cleanTitle = title.trim();
    const temporaryId = Date.now();
    setReminders(old => [{ id: temporaryId, title: cleanTitle, time }, ...old]);
    log(`Reminder saved: ${cleanTitle}`);
    void fetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: cleanTitle, due_at: time }) })
      .then(async res => { if (!res.ok) throw new Error('Reminder API request failed'); const saved = await res.json(); if (saved?.id != null) setReminders(old => old.map(r => r.id === temporaryId ? { ...r, id: Number(saved.id), time: saved.due_at || time } : r)); })
      .catch(error => console.warn('Reminder was added locally but not saved to the API.', error));
    return true;
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    setMessages(old => [...old, { role: 'user', text }]);
    setInput('');
    const lower = text.toLowerCase();
    let response = '';
    if (lower.includes('list') && lower.includes('task') || lower.includes('show my tasks')) {
      response = tasks.length ? `You have ${tasks.filter(t => !t.done).length} pending tasks:\n${tasks.filter(t => !t.done).map(t => `• ${t.title}`).join('\n')}` : 'Your task list is empty. Add a task from My Tasks.';
    } else if (lower.includes('add task') || lower.includes('create task') || lower.includes('remind me to')) {
      const title = text.replace(/^(please\s+)?(add|create)\s+(a\s+)?(task|to-do)(\s+to)?\s*/i, '').replace(/^remind me to\s*/i, '').trim();
      if (title && addTask(title)) response = `I created the task “${title}” and saved it to your task list.`;
      else response = 'Please tell me what task you want to create.';
    } else if (lower.includes('reminder')) {
      response = reminders.length ? `Your saved reminders:\n${reminders.map(r => `• ${r.title} — ${r.time}`).join('\n')}\n\nTo add one, open the Reminders section.` : 'You have no saved reminders yet. Open Reminders to create one.';
    } else if (lower.includes('smart home') || lower.includes('lights') || lower.includes('fan')) {
      const target = devices.find(d => lower.includes(d.name.toLowerCase()) || (lower.includes('living room') && d.name.toLowerCase().includes('living room')) || (lower.includes('bedroom') && d.name.toLowerCase().includes('bedroom')) || (lower.includes('fan') && (d.name.toLowerCase().includes('fan') || d.icon === 'fan')));
      if (target && (lower.includes('turn on') || lower.includes('switch on') || lower.includes('turn off') || lower.includes('switch off'))) {
        const on = lower.includes('turn on') || lower.includes('switch on');
        setDevices(old => old.map(d => d.id === target.id ? { ...d, on } : d));
        void fetch(`/api/devices/${target.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_on: on }) }).catch(console.warn);
        log(`${target.name} turned ${on ? 'on' : 'off'} in simulator`);
        response = `${target.name} is now ${on ? 'on' : 'off'} in the smart-home simulator.`;
      } else response = 'You can control the living room lights, bedroom lights and smart fan in Smart Home. Try “Turn on the living room lights”.';
    } else if (lower.includes('plan') || lower.includes('schedule') || lower.includes('study')) {
      response = `Here is a suggested plan based on your saved tasks:\n• 9:00 AM — Review your priorities\n• 10:00 AM — ${tasks.find(t => !t.done)?.title || 'Focus session'}\n• 12:00 PM — Break and lunch\n• 2:00 PM — Study or project work\n• 5:00 PM — Review progress\n\nThis is a suggested plan, not a connected calendar. Open Daily Planner to view it.`;
      log('Daily plan generated');
    } else {
      response = 'I can help with tasks, reminders, daily plans and simulated smart-home controls. Try “Add task to finish my assignment”, “Show my tasks” or “Turn on the living room lights”. This prototype uses a local command parser; live AI will be a later integration.';
    }
    setMessages(old => [...old, { role: 'assistant', text: response }]);
  };

  const navItems: { name: Section; icon: typeof Home }[] = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'AI Assistant', icon: MessageCircle },
    { name: 'My Tasks', icon: ListTodo },
    { name: 'Reminders', icon: Bell },
    { name: 'Daily Planner', icon: CalendarDays },
    { name: 'Smart Home', icon: Home },
    { name: 'Activity History', icon: Activity },
  ];

  const doneCount = tasks.filter(t => t.done).length;
  const progress = tasks.length ? Math.round(doneCount / tasks.length * 100) : 0;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });

  const go = (name: Section) => { setSection(name); setMobileMenu(false); };

  return (
    <div className="app-shell">
      {mobileMenu && <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="Close menu" />}
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Waves size={23} /></div>
          <div><strong>Alexa+ <span>LifeOS</span></strong><small>YOUR PERSONAL SPACE</small></div>
          <button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close"><X /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {navItems.map(item => {
            const Icon = item.icon;
            return <button key={item.name} className={`nav-link ${section === item.name ? 'active' : ''}`} onClick={() => go(item.name)}>
              <Icon size={18} strokeWidth={1.8} /><span>{item.name}</span>{section === item.name && <ChevronRight size={15} className="nav-chevron" />}
            </button>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="status-card"><span className="status-dot" /><div><strong>LifeOS is ready</strong><small>Local demo mode</small></div></div>
          <div className="profile"><div className="avatar">L</div><div><strong>My Workspace</strong><small>Personal assistant</small></div><Settings2 size={17} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu /></button>
          <div className="breadcrumb">LifeOS <span>/</span> <strong>{section}</strong></div>
          <div className="topbar-right"><span className="online-label"><span className="status-dot" /> System ready</span><div className="top-avatar">L</div></div>
        </header>

        <div className="page-content">
          {section === 'Overview' && <>
            <div className="welcome-row"><div><div className="eyebrow"><Sparkles size={14} /> YOUR PERSONAL COMMAND CENTER</div><h1>Make room for <span>what matters.</span></h1><p className="subheading">Your day, your tasks, your space — all working together.</p></div><div className="date-chip"><CalendarDays size={16} /> {today}</div></div>
            <div className="hero-card"><div className="hero-copy"><div className="hero-tag"><Sparkles size={14} /> YOUR DAY, SIMPLIFIED</div><h2>One thought.<br />Everything in motion.</h2><p>Tell your assistant what you need. Let LifeOS turn your intentions into action.</p><button className="primary-button" onClick={() => go('AI Assistant')}>Talk to your assistant <ArrowUpRight size={17} /></button></div><div className="hero-visual"><div className="orb orb-one" /><div className="orb orb-two" /><div className="orb-core"><Waves size={48} /></div><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="float-chip chip-a"><Check size={14} /> Task organized</div><div className="float-chip chip-b"><Zap size={14} /> Ready when you are</div></div></div>
            <div className="section-heading"><div><h2>Your overview</h2><p>A quick look at what’s happening.</p></div><button className="text-button" onClick={() => go('Activity History')}>View activity <ArrowUpRight size={15} /></button></div>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-top"><span>Tasks completed</span><div className="stat-icon purple"><CheckCheck size={19} /></div></div><div className="stat-number">{doneCount}<small> / {tasks.length}</small></div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div><div className="stat-foot">{progress}% of your task list completed</div></div>
              <div className="stat-card"><div className="stat-top"><span>Open tasks</span><div className="stat-icon blue"><ListTodo size={19} /></div></div><div className="stat-number">{tasks.length - doneCount}</div><div className="stat-foot">Keep your momentum going</div><button className="card-link" onClick={() => go('My Tasks')}>Manage tasks <ChevronRight size={14} /></button></div>
              <div className="stat-card"><div className="stat-top"><span>Reminders saved</span><div className="stat-icon amber"><Bell size={19} /></div></div><div className="stat-number">{reminders.length}</div><div className="stat-foot">Stored in your workspace</div><button className="card-link" onClick={() => go('Reminders')}>View reminders <ChevronRight size={14} /></button></div>
              <div className="stat-card"><div className="stat-top"><span>Smart devices</span><div className="stat-icon cyan"><Zap size={19} /></div></div><div className="stat-number">{devices.filter(d => d.on).length}<small> / {devices.length} active</small></div><div className="stat-foot">Simulation only · No real devices</div><button className="card-link" onClick={() => go('Smart Home')}>Open smart home <ChevronRight size={14} /></button></div>
            </div>
            <div className="overview-columns"><section className="panel"><div className="panel-heading"><div><h3>Priority tasks</h3><p>Your next steps at a glance</p></div><button className="icon-button" onClick={() => go('My Tasks')} aria-label="All tasks"><ArrowUpRight size={17} /></button></div>{tasks.filter(t => !t.done).slice(0, 4).map(task => <div className="task-row" key={task.id}><button className="check-circle" onClick={() => { setTasks(old => old.map(t => t.id === task.id ? { ...t, done: true } : t)); void fetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: true }) }).catch(console.warn); log(`Task completed: ${task.title}`); }} aria-label="Complete task"><Circle size={19} /></button><span className="task-title">{task.title}</span><span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span></div>)}{tasks.every(t => t.done) && <p className="empty-note">All tasks completed. Nice work!</p>}<button className="panel-footer" onClick={() => go('My Tasks')}>View all tasks <ChevronRight size={15} /></button></section>
            <section className="panel"><div className="panel-heading"><div><h3>Coming up</h3><p>Your saved reminders</p></div><button className="icon-button" onClick={() => go('Reminders')} aria-label="All reminders"><ArrowUpRight size={17} /></button></div>{reminders.slice(0, 3).map(r => <div className="reminder-row" key={r.id}><div className="reminder-icon"><Clock3 size={17} /></div><div className="reminder-copy"><strong>{r.title}</strong><small>{r.time}</small></div></div>)}{!reminders.length && <p className="empty-note">No reminders yet.</p>}<button className="panel-footer" onClick={() => go('Reminders')}>All reminders <ChevronRight size={15} /></button></section></div>
            <section className="quick-actions"><div><h3>What would you like to do?</h3><p>Jump straight into your next action.</p></div><button onClick={() => go('AI Assistant')}><MessageCircle size={19} /><span><strong>Ask the assistant</strong><small>Tell LifeOS what you need</small></span><ChevronRight size={16} /></button><button onClick={() => go('My Tasks')}><Plus size={19} /><span><strong>Organize tasks</strong><small>Keep track of your work</small></span><ChevronRight size={16} /></button><button onClick={() => go('Daily Planner')}><CalendarDays size={19} /><span><strong>Plan my day</strong><small>Build a focused schedule</small></span><ChevronRight size={16} /></button></section>
          </>}

          {section === 'AI Assistant' && <div className="inner-page"><div className="page-title"><div className="eyebrow"><Sparkles size={14} /> CONVERSATIONAL WORKSPACE</div><h1>Your assistant, <span>at your service.</span></h1><p>Give a command in plain English. Supported actions update your local workspace.</p></div><div className="chat-panel"><div className="chat-header"><div className="assistant-avatar"><Bot size={22} /></div><div><strong>LifeOS Assistant</strong><small><span className="status-dot" /> Local command mode</small></div><span className="demo-pill">DEMO</span></div><div className="chat-messages">{messages.map((m, i) => <div key={i} className={`message ${m.role}`}><div className="message-avatar">{m.role === 'assistant' ? <Sparkles size={16} /> : 'Y'}</div><div className="message-bubble">{m.text}</div></div>)}</div><div className="suggestion-row">{['Show my tasks', 'Plan my day', 'Turn on the living room lights'].map(s => <button key={s} onClick={() => { setInput(s); }}>{s} <ArrowUpRight size={13} /></button>)}</div><form className="chat-input-row" onSubmit={e => { e.preventDefault(); sendMessage(); }}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Tell LifeOS what you need..." /><button className="send-button" type="submit" aria-label="Send message"><Send size={18} /></button></form><div className="chat-disclaimer">Local prototype · No live AI API connected yet</div></div></div>}

          {section === 'My Tasks' && <div className="inner-page"><div className="page-title"><div className="eyebrow"><ListTodo size={14} /> STAY ON TRACK</div><h1>Make progress, <span>one task at a time.</span></h1><p>Tasks sync with the LifeOS API and SQLite database when the backend is running.</p></div><form className="add-form" onSubmit={e => { e.preventDefault(); if (addTask(newTask)) setNewTask(''); }}><input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="What do you need to get done?" /><button className="primary-button" type="submit"><Plus size={17} /> Add task</button></form><div className="list-summary"><span>{tasks.filter(t => !t.done).length} pending</span><span>{doneCount} completed</span></div><div className="panel task-list-panel">{tasks.map(task => <div className={`full-task ${task.done ? 'task-done' : ''}`} key={task.id}><button className={`check-circle ${task.done ? 'checked' : ''}`} onClick={() => { setTasks(old => old.map(t => t.id === task.id ? { ...t, done: !t.done } : t)); void fetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: !task.done }) }).catch(console.warn); log(`Task ${task.done ? 'reopened' : 'completed'}: ${task.title}`); }} aria-label="Toggle completion">{task.done ? <Check size={16} /> : <Circle size={19} />}</button><span className="task-title">{task.title}</span><span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span><button className="delete-button" onClick={() => { setTasks(old => old.filter(t => t.id !== task.id)); void fetch(`/api/tasks/${task.id}`, { method: 'DELETE' }).catch(console.warn); log(`Task deleted: ${task.title}`); }} aria-label="Delete task"><Trash2 size={16} /></button></div>)}{!tasks.length && <p className="empty-note">No tasks yet. Add your first task above.</p>}</div></div>}

          {section === 'Reminders' && <div className="inner-page"><div className="page-title"><div className="eyebrow"><Bell size={14} /> NEVER LOSE YOUR PLACE</div><h1>Remember what <span>matters.</span></h1><p>Save a title and time. Reminders sync with SQLite; notifications are not enabled yet.</p></div><form className="add-form reminder-form" onSubmit={e => { e.preventDefault(); if (addReminder(newReminder, reminderTime)) { setNewReminder(''); setReminderTime(''); } }}><input value={newReminder} onChange={e => setNewReminder(e.target.value)} placeholder="Reminder title" required /><input type="datetime-local" value={reminderTime} onChange={e => setReminderTime(e.target.value)} required /><button className="primary-button" type="submit"><Plus size={17} /> Save reminder</button></form><div className="panel task-list-panel">{reminders.map(r => <div className="full-task" key={r.id}><div className="reminder-icon"><Bell size={17} /></div><div className="reminder-copy"><strong>{r.title}</strong><small>{r.time}</small></div><button className="delete-button" onClick={() => { setReminders(old => old.filter(x => x.id !== r.id)); void fetch(`/api/reminders/${r.id}`, { method: 'DELETE' }).catch(console.warn); log(`Reminder deleted: ${r.title}`); }} aria-label="Delete reminder"><Trash2 size={16} /></button></div>)}{!reminders.length && <p className="empty-note">No reminders saved. Create one above.</p>}</div></div>}

          {section === 'Daily Planner' && <div className="inner-page"><div className="page-title"><div className="eyebrow"><CalendarDays size={14} /> CREATE SPACE FOR YOUR PRIORITIES</div><h1>A more intentional <span>day starts here.</span></h1><p>A sample schedule to help structure your day. Adjust it to your real commitments.</p></div><div className="planner-banner"><div><Sparkles size={20} /><strong>Your suggested daily flow</strong></div><span>{today}</span></div><div className="panel timeline">{[{time:'09:00 AM',title:'Review priorities',desc:'Choose the three things that matter most.'},{time:'10:00 AM',title:tasks.find(t => !t.done)?.title || 'Focus session',desc:'Work on your highest-priority task.',tag:'FOCUS'},{time:'12:00 PM',title:'Recharge',desc:'Take a break and have lunch.'},{time:'02:00 PM',title:'Study or project work',desc:'Make steady progress on your goals.'},{time:'05:00 PM',title:'Review and reset',desc:'Reflect on progress and prepare for tomorrow.'}].map(item => <div className="timeline-row" key={item.time}><div className="timeline-time">{item.time}</div><div className="timeline-marker"><span /></div><div className="timeline-event"><strong>{item.title}</strong><p>{item.desc}</p></div>{'tag' in item && <span className="priority priority-high">{item.tag}</span>}</div>)}</div><p className="note-text">This is a suggested template, not a connected calendar. Events have not been booked.</p></div>}

          {section === 'Smart Home' && <div className="inner-page"><div className="page-title"><div className="eyebrow"><Home size={14} /> YOUR CONNECTED SPACE</div><h1>Comfort, <span>under your control.</span></h1><p>Try the controls below. Every device is simulated; no physical hardware is connected.</p></div><div className="home-banner"><div className="home-banner-icon"><Home size={25} /></div><div><strong>My home</strong><p>{devices.filter(d => d.on).length} of {devices.length} simulated devices active</p></div><span className="demo-pill">SIMULATION</span></div><div className="device-grid">{devices.map(d => <div className={`device-card ${d.on ? 'device-on' : ''}`} key={d.id}><div className="device-card-top"><div className={`device-icon ${d.on ? 'device-icon-on' : ''}`}>{d.icon === 'light' ? <Lightbulb size={23} /> : d.icon === 'fan' ? <Fan size={23} /> : <Thermometer size={23} />}</div><button className={`toggle ${d.on ? 'toggle-on' : ''}`} onClick={() => { setDevices(old => old.map(x => x.id === d.id ? { ...x, on: !x.on } : x)); void fetch(`/api/devices/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_on: !d.on }) }).catch(console.warn); log(`${d.name} toggled ${d.on ? 'off' : 'on'} in simulator`); }} aria-label={`Toggle ${d.name}`}><span /></button></div><h3>{d.name}</h3><p>{d.room}</p><div className="device-state"><span className={d.on ? 'status-dot' : 'status-dot off'} />{d.on ? 'On' : 'Off'}<span className="state-note">{d.on ? 'Active' : 'Standby'}</span></div></div>)}</div></div>}

          {section === 'Activity History' && <div className="inner-page"><div className="page-title"><div className="eyebrow"><Activity size={14} /> YOUR WORKSPACE, IN CONTEXT</div><h1>Every action, <span>in one place.</span></h1><p>Recent actions recorded in your workspace.</p></div><div className="panel activity-list">{history.map((item,i) => <div className="activity-row" key={`${item}-${i}`}><div className="activity-icon"><Check size={16} /></div><div><strong>{item}</strong><small>Activity recorded in this session history</small></div></div>)}{!history.length && <p className="empty-note">Your activity will appear here as you use LifeOS.</p>}</div><button className="text-button clear-history" onClick={() => setHistory([])}>Clear activity history <Trash2 size={15} /></button></div>}
          <footer className="footer"><span><Waves size={15} /> Alexa+ LifeOS <span className="footer-sep">·</span> Independent prototype</span><span>Designed for a more intentional day.</span></footer>
        </div>
      </main>
    </div>
  );
}



