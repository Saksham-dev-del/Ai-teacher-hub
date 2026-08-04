let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let lessonEvents = [];
let selectedCalendarDate = null;

function dateInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function calendarRange() {
  const start = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 42);
  return { start, end };
}

function sameDay(a, b) {
  const x = new Date(a); const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

function formatEventTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function populateCalendarResourceSelect() {
  const select = document.getElementById('cal-resource');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">No linked resource</option>' + resources.map((r) => `<option value="${r._id}">${escapeHtml(r.type)} · ${escapeHtml(r.topic)}</option>`).join('');
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

async function loadLessonCalendar() {
  const { start, end } = calendarRange();
  try {
    const data = await apiLoadCalendar(start, end);
    lessonEvents = data.events || [];
    renderCalendarGrid();
    renderCalendarAgenda();
  } catch (err) {
    document.getElementById('calendar-grid').innerHTML = `<div class="phase3-empty error" style="grid-column:1/-1"><b>Could not load calendar</b><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderCalendarGrid() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  const { start } = calendarRange();
  const today = new Date();
  document.getElementById('calendar-month-label').textContent = calendarCursor.toLocaleDateString([], { month: 'long', year: 'numeric' });
  document.getElementById('calendar-range-label').textContent = `${lessonEvents.length} scheduled event${lessonEvents.length === 1 ? '' : 's'}`;
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const events = lessonEvents.filter((event) => sameDay(event.start, date));
    const otherMonth = date.getMonth() !== calendarCursor.getMonth();
    cells.push(`<button class="calendar-day ${otherMonth ? 'other-month' : ''} ${sameDay(date, today) ? 'today' : ''} ${selectedCalendarDate && sameDay(date, selectedCalendarDate) ? 'selected' : ''}" data-calendar-day="${date.toISOString()}" style="--delay:${i * 10}ms">
      <span class="calendar-date-number">${date.getDate()}</span>
      <div class="calendar-day-events">${events.slice(0, 3).map((event) => `<span class="calendar-event-chip status-${event.status}" data-calendar-event="${event._id}" style="--event-color:${event.color || '#2F5D50'}"><i></i>${escapeHtml(event.title)}</span>`).join('')}${events.length > 3 ? `<em>+${events.length - 3} more</em>` : ''}</div>
    </button>`);
  }
  grid.innerHTML = cells.join('');
  grid.querySelectorAll('[data-calendar-day]').forEach((button) => button.addEventListener('click', (event) => {
    if (event.target.closest('[data-calendar-event]')) return;
    selectedCalendarDate = new Date(button.dataset.calendarDay);
    if (phase3Role() !== 'student') openCalendarEditor(null, selectedCalendarDate);
    else renderCalendarGrid();
  }));
  grid.querySelectorAll('[data-calendar-event]').forEach((chip) => chip.addEventListener('click', (event) => {
    event.stopPropagation();
    const item = lessonEvents.find((x) => x._id === chip.dataset.calendarEvent);
    if (phase3Role() === 'student') showCalendarEventDetails(item);
    else openCalendarEditor(item);
  }));
  if (window.runMotionEntrance) window.runMotionEntrance(grid);
}

function renderCalendarAgenda() {
  const list = document.getElementById('calendar-agenda-list');
  if (!list) return;
  const now = Date.now();
  const upcoming = lessonEvents.filter((event) => new Date(event.end).getTime() >= now).sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 12);
  list.innerHTML = upcoming.length ? upcoming.map((event, index) => `<button class="agenda-item motion-card" data-agenda-event="${event._id}" style="--event-color:${event.color || '#2F5D50'};--delay:${index * 45}ms"><i></i><div><b>${escapeHtml(event.title)}</b><span>${new Date(event.start).toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${formatEventTime(event.start)} · ${escapeHtml(event.eventType)}</span><small>${escapeHtml(event.course || '')} ${event.subject ? '· ' + escapeHtml(event.subject) : ''}</small></div><em class="status-${event.status}">${escapeHtml(event.status)}</em></button>`).join('') : '<div class="phase3-empty compact"><b>No upcoming events</b><p>Schedule your first lesson, lab or revision session.</p></div>';
  list.querySelectorAll('[data-agenda-event]').forEach((button) => button.addEventListener('click', () => {
    const event = lessonEvents.find((x) => x._id === button.dataset.agendaEvent);
    if (phase3Role() === 'student') showCalendarEventDetails(event); else openCalendarEditor(event);
  }));
  if (window.runMotionEntrance) window.runMotionEntrance(list);
}

function showCalendarEventDetails(event) {
  if (!event) return;
  modalBackdrop.classList.add('open');
  modalBox.innerHTML = `<button class="modal-close" data-role="modal-close">X</button><div class="calendar-detail"><span class="quiz-status published">${escapeHtml(event.eventType)}</span><h2>${escapeHtml(event.title)}</h2><p>${new Date(event.start).toLocaleString()} — ${new Date(event.end).toLocaleString()}</p><div class="calendar-detail-grid"><div><small>Course</small><b>${escapeHtml(event.course || 'General')}</b></div><div><small>Subject</small><b>${escapeHtml(event.subject || 'General')}</b></div><div><small>Topic</small><b>${escapeHtml(event.topic || event.title)}</b></div><div><small>Status</small><b>${escapeHtml(event.status)}</b></div></div>${event.notes ? `<article><b>Teacher notes</b><p>${escapeHtml(event.notes)}</p></article>` : ''}</div>`;
  modalBox.querySelector('[data-role="modal-close"]').addEventListener('click', closeModal);
  if (window.runMotionEntrance) window.runMotionEntrance(modalBox);
}

function openCalendarEditor(event = null, date = null) {
  const editor = document.getElementById('calendar-editor');
  if (phase3Role() === 'student' || !editor) return;
  populateCalendarResourceSelect();
  const start = event ? new Date(event.start) : new Date(date || new Date());
  if (!event) {
    start.setHours(start.getHours() + 1, 0, 0, 0);
  }
  const end = event ? new Date(event.end) : new Date(start.getTime() + 45 * 60000);
  document.getElementById('cal-event-id').value = event?._id || '';
  document.getElementById('cal-title').value = event?.title || '';
  document.getElementById('cal-start').value = dateInputValue(start);
  document.getElementById('cal-end').value = dateInputValue(end);
  document.getElementById('cal-type').value = event?.eventType || 'lecture';
  document.getElementById('cal-status').value = event?.status || 'planned';
  document.getElementById('cal-resource').value = event?.resource?._id || event?.resource || '';
  document.getElementById('cal-course').value = event?.course || '';
  document.getElementById('cal-subject').value = event?.subject || '';
  document.getElementById('cal-topic').value = event?.topic || '';
  document.getElementById('cal-notes').value = event?.notes || '';
  document.getElementById('cal-shared').checked = event ? event.shared !== false : true;
  document.getElementById('calendar-editor-title').textContent = event ? 'Edit lesson event' : 'Schedule lesson';
  document.getElementById('btn-delete-calendar-event').style.display = event ? '' : 'none';
  document.getElementById('calendar-editor-status').textContent = '';
  editor.classList.add('open');
  editor.setAttribute('aria-hidden', 'false');
  if (window.Motion) Motion.animate('.calendar-editor-card', { opacity: [0, 1], x: [50, 0], scale: [0.97, 1] }, { duration: 0.38, easing: [0.22, 1, 0.36, 1] });
}

function closeCalendarEditor() {
  const editor = document.getElementById('calendar-editor');
  if (!editor) return;
  editor.classList.remove('open');
  editor.setAttribute('aria-hidden', 'true');
}

function calendarPayload() {
  const resource = resources.find((r) => r._id === document.getElementById('cal-resource').value);
  return {
    title: document.getElementById('cal-title').value.trim(),
    start: new Date(document.getElementById('cal-start').value).toISOString(),
    end: new Date(document.getElementById('cal-end').value).toISOString(),
    eventType: document.getElementById('cal-type').value,
    status: document.getElementById('cal-status').value,
    resourceId: document.getElementById('cal-resource').value || null,
    course: document.getElementById('cal-course').value.trim() || resource?.course || '',
    subject: document.getElementById('cal-subject').value.trim() || resource?.subject || '',
    topic: document.getElementById('cal-topic').value.trim() || resource?.topic || '',
    notes: document.getElementById('cal-notes').value.trim(),
    shared: document.getElementById('cal-shared').checked,
    color: TYPE_COLORS[resource?.type] || '#2F5D50'
  };
}

async function saveCalendarEvent() {
  const status = document.getElementById('calendar-editor-status');
  const button = document.getElementById('btn-save-calendar-event');
  let payload;
  try { payload = calendarPayload(); } catch (err) { return showToast('Enter valid start and end times.', 'error'); }
  if (!payload.title) return showToast('Enter an event title.', 'error');
  const id = document.getElementById('cal-event-id').value;
  button.disabled = true;
  status.innerHTML = '<span class="status-pulse"></span> Saving lesson schedule...';
  try {
    if (id) await apiUpdateCalendarEvent(id, payload); else await apiCreateCalendarEvent(payload);
    showToast(id ? 'Lesson event updated' : 'Lesson event scheduled', 'success');
    closeCalendarEditor();
    await loadLessonCalendar();
  } catch (err) {
    status.textContent = err.message;
  } finally { button.disabled = false; }
}

async function deleteCalendarEvent() {
  const id = document.getElementById('cal-event-id').value;
  if (!id || !confirm('Delete this lesson event?')) return;
  try {
    await apiDeleteCalendarEvent(id);
    closeCalendarEditor();
    showToast('Lesson event deleted', 'success');
    await loadLessonCalendar();
  } catch (err) { showToast(err.message, 'error'); }
}

function renderCalendar() {
  const teacherOnly = document.querySelectorAll('#view-calendar .phase3-teacher-only');
  teacherOnly.forEach((el) => { el.style.display = phase3Role() === 'student' ? 'none' : ''; });
  populateCalendarResourceSelect();
  loadLessonCalendar();
}

document.getElementById('calendar-prev')?.addEventListener('click', () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); loadLessonCalendar(); });
document.getElementById('calendar-next')?.addEventListener('click', () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); loadLessonCalendar(); });
document.getElementById('calendar-today')?.addEventListener('click', () => { calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1); loadLessonCalendar(); });
document.getElementById('btn-new-calendar-event')?.addEventListener('click', () => openCalendarEditor(null, new Date()));
document.getElementById('calendar-editor-close')?.addEventListener('click', closeCalendarEditor);
document.getElementById('btn-save-calendar-event')?.addEventListener('click', saveCalendarEvent);
document.getElementById('btn-delete-calendar-event')?.addEventListener('click', deleteCalendarEvent);
document.getElementById('cal-resource')?.addEventListener('change', (event) => {
  const resource = resources.find((r) => r._id === event.target.value);
  if (!resource) return;
  document.getElementById('cal-title').value ||= `${resource.type}: ${resource.topic}`;
  document.getElementById('cal-course').value = resource.course || '';
  document.getElementById('cal-subject').value = resource.subject || '';
  document.getElementById('cal-topic').value = resource.topic || '';
});
