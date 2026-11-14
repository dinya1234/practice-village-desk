(function () {
  'use strict'

  const STATUS_OPEN = 'Открыто'
  const STATUS_PROGRESS = 'В работе'
  const STATUS_DONE = 'Выполнено'
  const OUTCOME_ACCEPTED = 'Принят'
  const OUTCOME_MISSED = 'Пропущен'
  const OUTCOME_CALLBACK = 'Перезвонили'
  const TOKEN_KEY = 'village-desk:token'

  let state = null
  let account = null
  let version = 0
  let view = { type: 'idle' }
  let selectedTicketId = null
  let notice = null
  let saveChain = Promise.resolve()

  const els = {
    login: document.querySelector('#login'),
    loginForm: document.querySelector('#login-form'),
    loginError: document.querySelector('#login-error'),
    workspace: document.querySelector('#workspace'),
    who: document.querySelector('#who'),
    notice: document.querySelector('#notice'),
    incoming: document.querySelector('#incoming'),
    missed: document.querySelector('#missed'),
    caller: document.querySelector('#caller'),
    ticket: document.querySelector('#ticket'),
    journal: document.querySelector('#journal')
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value)
  }

  function formatTime(iso) {
    if (!iso) return '—'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return String(iso)
    return pad(date.getDate()) + '.' + pad(date.getMonth() + 1) + '.' + date.getFullYear() +
      ', ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
  }

  function timeValue(iso) {
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? 0 : date.getTime()
  }

  function nowIso() {
    return new Date().toISOString()
  }

  function nextId(prefix, list) {
    const pattern = new RegExp('^' + prefix + '-(\\d+)$')
    let max = 0
    list.forEach(function (item) {
      const match = pattern.exec(String(item.id || ''))
      if (match) max = Math.max(max, Number(match[1]))
    })
    return prefix + '-' + (max + 1)
  }

  function findResident(id) {
    return state.residents.find(function (item) { return item.id === id }) || null
  }

  function findWorker(id) {
    return state.workers.find(function (item) { return item.id === id }) || null
  }

  function findTicket(id) {
    return state.tickets.find(function (item) { return item.id === id }) || null
  }

  function findCall(id) {
    return state.calls.find(function (item) { return item.id === id }) || null
  }

  function findQueueCall(id) {
    if (state.current && state.current.id === id) return state.current
    return state.queue.find(function (item) { return item.id === id }) || null
  }

  function nextCallId() {
    const all = state.calls.concat(state.queue, state.current ? [state.current] : [])
    return nextId('c', all)
  }

  function residentOfLine(line) {
    return state.residents.find(function (item) { return item.line === line }) || null
  }

  function callsOf(ticketId) {
    return state.calls.filter(function (item) { return item.ticketId === ticketId })
  }

  function ticketsOf(residentId) {
    return state.tickets
      .filter(function (item) { return item.residentId === residentId })
      .sort(function (a, b) { return timeValue(b.createdAt) - timeValue(a.createdAt) })
  }

  function missedQueue() {
    return state.calls
      .filter(function (item) { return item.outcome === OUTCOME_MISSED && !item.resolvedBy })
      .sort(function (a, b) { return timeValue(a.at) - timeValue(b.at) })
  }

  function nameFor(call) {
    if (call.residentId) {
      const resident = findResident(call.residentId)
      if (resident) return resident.name
    }
    const byLine = residentOfLine(call.line)
    return byLine ? byLine.name : 'Житель не определён'
  }

  function statusBadge(status) {
    const cls = status === STATUS_DONE ? 'done' : status === STATUS_PROGRESS ? 'progress' : 'open'
    return '<span class="badge ' + cls + '">' + esc(status) + '</span>'
  }

  function outcomeBadge(outcome) {
    const cls = outcome === OUTCOME_MISSED ? 'missed' : outcome === OUTCOME_CALLBACK ? 'callback' : 'accepted'
    return '<span class="badge ' + cls + '">' + esc(outcome) + '</span>'
  }

  function allLines() {
    const set = new Set()
    state.residents.forEach(function (item) { set.add(item.line) })
    const examples = (window.villageData && window.villageData.incomingExamples) || []
    examples.forEach(function (item) { set.add(item.line) })
    return Array.from(set).sort()
  }

  function normalize(data) {
    const next = {
      residents: Array.isArray(data.residents) ? data.residents : [],
      workers: Array.isArray(data.workers) ? data.workers : [],
      tickets: Array.isArray(data.tickets) ? data.tickets : [],
      calls: Array.isArray(data.calls) ? data.calls : [],
      queue: Array.isArray(data.queue) ? data.queue : [],
      current: data.current && data.current.line ? data.current : null,
      usedLines: Array.isArray(data.usedLines) ? data.usedLines.slice() : []
    }
    if (data.incoming && data.incoming.line) {
      if (data.incoming.accepted) {
        if (!next.current) next.current = data.incoming
      } else {
        next.queue.push(data.incoming)
      }
    }
    next.tickets.forEach(function (ticket) {
      ticket.result = ticket.result || ''
      ticket.updatedAt = ticket.updatedAt || ticket.createdAt
    })
    next.calls.forEach(function (call) {
      call.text = call.text || ''
      call.resolvedBy = call.resolvedBy || null
    })
    next.queue.forEach(function (call) {
      call.text = call.text || ''
      call.residentId = call.residentId || null
      if (next.usedLines.indexOf(call.line) < 0) next.usedLines.push(call.line)
    })
    if (next.current) {
      next.current.text = next.current.text || ''
      next.current.residentId = next.current.residentId || null
      next.current.accepted = true
      if (next.usedLines.indexOf(next.current.line) < 0) next.usedLines.push(next.current.line)
    }
    return next
  }

  function readToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || ''
    } catch (error) {
      return ''
    }
  }

  function writeToken(value) {
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value)
      else sessionStorage.removeItem(TOKEN_KEY)
    } catch (error) {
      return
    }
  }

  async function api(path, options) {
    const headers = { 'Content-Type': 'application/json' }
    const token = readToken()
    if (token) headers.Authorization = 'Bearer ' + token
    const response = await fetch(path, Object.assign({ headers: headers }, options || {}))
    let data = null
    try {
      data = await response.json()
    } catch (error) {
      data = null
    }
    return { response: response, data: data }
  }

  function showLogin(message) {
    writeToken('')
    account = null
    state = null
    version = 0
    view = { type: 'idle' }
    selectedTicketId = null
    notice = null
    els.workspace.hidden = true
    els.login.hidden = false
    els.loginError.hidden = !message
    els.loginError.textContent = message || ''
    const field = els.loginForm.querySelector('[name="login"]')
    if (field) field.focus()
  }

  function applySnapshot(data) {
    account = data.account
    version = data.version
    state = normalize(data.state)
    els.who.textContent = account ? account.name + ' · ' + account.shift : ''
    els.login.hidden = true
    els.workspace.hidden = false
    if (state.current) {
      view = { type: 'incoming', callId: state.current.id }
      const resident = residentOfLine(state.current.line)
      const tickets = resident ? ticketsOf(resident.id) : []
      if (tickets.length) selectedTicketId = tickets[0].id
    }
  }

  async function boot() {
    let result = null
    try {
      result = await api('/api/bootstrap')
    } catch (error) {
      if (!account) showLogin('Сервер не отвечает. Запустите приложение и обновите страницу.')
      return
    }
    if (result.response.status === 401 || (result.data && !result.data.account)) {
      if (!account) showLogin('')
      return
    }
    if (!result.response.ok || !result.data) {
      if (!account) showLogin('Сервер не отвечает. Запустите приложение и обновите страницу.')
      return
    }
    applySnapshot(result.data)
    render()
  }

  async function submitLogin(form) {
    const data = new FormData(form)
    els.loginError.hidden = true
    let result = null
    try {
      result = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({
          login: String(data.get('login') || '').trim(),
          password: String(data.get('password') || '')
        })
      })
    } catch (error) {
      els.loginError.hidden = false
      els.loginError.textContent = 'Сервер не отвечает. Запустите приложение.'
      return
    }
    if (!result.response.ok || !result.data) {
      els.loginError.hidden = false
      els.loginError.textContent = result.data && result.data.error
        ? result.data.error
        : 'Не удалось войти'
      return
    }
    form.reset()
    writeToken(result.data.token || '')
    applySnapshot(result.data)
    render()
  }

  async function logout() {
    try {
      await api('/api/logout', { method: 'POST' })
    } catch (error) {
      notice = null
    }
    writeToken('')
    showLogin('')
  }

  function save() {
    saveChain = saveChain.then(pushState).catch(function () {})
  }

  async function pushState() {
    let result = null
    try {
      result = await api('/api/state', {
        method: 'PUT',
        body: JSON.stringify({ version: version, state: state })
      })
    } catch (error) {
      notice = { kind: 'error', text: 'Сервер не отвечает, изменения не сохранены.' }
      renderNotice()
      return
    }
    if (result.response.status === 401) {
      showLogin('Сессия завершилась. Войдите снова.')
      return
    }
    if (result.response.status === 409 && result.data) {
      version = result.data.version
      state = normalize(result.data.state)
      notice = { kind: 'error', text: 'Другой диспетчер уже изменил данные. Экран обновлён, повторите действие.' }
      render()
      return
    }
    if (!result.response.ok || !result.data) {
      notice = { kind: 'error', text: 'Не удалось сохранить данные. Проверьте, что сервер запущен.' }
      renderNotice()
      return
    }
    version = result.data.version
  }

  function render() {
    renderNotice()
    renderIncoming()
    renderMissed()
    renderCaller()
    renderTicket()
    renderJournal()
  }

  function renderNotice() {
    if (!notice) {
      els.notice.innerHTML = ''
      return
    }
    const confirm = notice.kind === 'confirm'
      ? '<button type="button" class="btn small" data-action="reset-confirm">Сбросить</button>'
      : ''
    els.notice.innerHTML = '<div class="notice ' + esc(notice.kind) + '">' +
      '<span>' + esc(notice.text) + '</span>' +
      '<div class="actions">' + confirm +
      '<button type="button" class="btn ghost small" data-action="notice-close">Закрыть</button>' +
      '</div></div>'
  }

  function renderIncoming() {
    const locked = Boolean(state.current)
    const missedLines = missedQueue().map(function (call) { return call.line })
    const items = state.queue.map(function (call) {
      return '<button type="button" class="ringing" data-action="open-call" data-call="' + esc(call.id) + '"' +
        (locked ? ' disabled' : '') + '>' +
        '<span class="row-between"><span class="line">' + esc(call.line) + '</span>' +
        '<span class="time">' + esc(formatTime(call.at)) + '</span></span>' +
        '<span class="ring-name">' + esc(nameFor(call)) + '</span>' +
        '<span class="ring-text">' + esc(call.text) + '</span>' +
        '</button>'
    }).join('')
    const buttons = allLines()
      .filter(function (line) { return missedLines.indexOf(line) < 0 })
      .map(function (line) {
        const used = state.usedLines.indexOf(line) >= 0
        const busyLine = state.queue.some(function (call) { return call.line === line }) ||
          Boolean(state.current && state.current.line === line)
        return '<button type="button" class="line-btn" data-action="simulate" data-line="' + esc(line) + '"' +
          (used || busyLine ? ' disabled' : '') +
          (used ? ' title="Звонок с этой линии уже обработан"' : '') + '>' +
          '<span class="line">' + esc(line) + '</span>' +
          '</button>'
      }).join('')
    const allUsed = allLines().every(function (line) { return state.usedLines.indexOf(line) >= 0 })
    const hint = state.queue.length
      ? (locked ? '<p class="hint">Сначала завершите текущий звонок.</p>' : '')
      : (allUsed
        ? '<p class="hint">Все линии уже звонили. «Сбросить демо» начинает заново.</p>'
        : '<p class="hint">Входящих нет.</p>')
    const missedHint = missedLines.length
      ? '<p class="hint">Линии с пропущенными звонками появятся после обратного звонка.</p>'
      : ''
    els.incoming.innerHTML = '<div class="panel-head"><h2>Входящие</h2>' +
      '<span class="count">' + state.queue.length + '</span></div>' +
      '<div class="call-list">' + items + '</div>' + hint +
      '<div class="sim"><p class="label">Имитировать звонок</p>' +
      '<div class="lines">' + buttons + '</div>' + missedHint + '</div>'
  }

  function renderMissed() {
    const queue = missedQueue()
    const busy = Boolean(state.current) || state.queue.length > 0
    const items = queue.length
      ? queue.map(function (call) {
        const text = call.text ? '«' + call.text + '»' : 'Повод не записан'
        return '<li><div class="row-between"><span class="line">' + esc(call.line) + '</span>' +
          '<span class="time">' + esc(formatTime(call.at)) + '</span></div>' +
          '<p class="queue-name">' + esc(nameFor(call)) + '</p>' +
          '<p class="queue-text">' + esc(text) + '</p>' +
          '<button type="button" class="btn small" data-action="callback" data-call="' + esc(call.id) + '"' +
          (busy ? ' disabled' : '') + '>Перезвонить</button>' +
          '</li>'
      }).join('')
      : '<li class="hint">Пропущенных звонков нет.</li>'
    const hint = state.current
      ? 'Сначала завершите текущий звонок.'
      : (state.queue.length ? 'Сначала ответьте на входящий звонок.' : 'Очередь сохраняется после перезагрузки страницы.')
    els.missed.innerHTML = '<div class="panel-head"><h2>Перезвонить</h2>' +
      '<span class="count">' + queue.length + '</span></div>' +
      '<p class="hint">' + hint + '</p>' +
      '<ul class="queue">' + items + '</ul>'
  }

  function ticketRow(ticket, canRecord) {
    const worker = findWorker(ticket.workerId)
    const calls = callsOf(ticket.id)
    return '<div class="ticket-row">' +
      '<button type="button" class="ticket-open" data-action="open-ticket" data-ticket="' + esc(ticket.id) + '">' +
      '<span class="ticket-subject">#' + esc(ticket.id) + ' · ' + esc(ticket.subject) + '</span>' +
      '<span class="ticket-meta">' + statusBadge(ticket.status) + ' ' +
      (worker ? esc(worker.name + ' · ' + worker.role) : 'исполнитель не назначен') +
      ' · звонков: ' + calls.length + '</span>' +
      (ticket.result ? '<span class="ticket-result">Результат: ' + esc(ticket.result) + '</span>' : '') +
      '</button>' +
      (canRecord && ticket.status !== STATUS_DONE
        ? '<button type="button" class="btn primary small" data-action="record" data-ticket="' +
          esc(ticket.id) + '">Записать звонок</button>'
        : '') +
      '</div>'
  }

  function renderCaller() {
    if (view.type === 'idle') {
      let idle = '<p class="hint">Нажмите линию слева, чтобы сымитировать входящий звонок.</p>'
      if (state.current) {
        idle = '<p class="hint">Звонок с линии ' + esc(state.current.line) + ' (' + esc(nameFor(state.current)) +
          ') принят, но ещё не записан.</p>' +
          '<div class="actions"><button type="button" class="btn primary" data-action="open-call" data-call="' +
          esc(state.current.id) + '">Вернуться к звонку</button></div>'
      } else if (state.queue.length) {
        idle = '<p class="hint">Звонки ждут в «Входящих»: откройте звонок и примите его.</p>'
      }
      els.caller.innerHTML = '<div class="panel-head"><h2>Звонящий</h2></div>' + idle
      return
    }
    const isCallback = view.type === 'callback'
    const source = isCallback ? findCall(view.callId) : findQueueCall(view.callId)
    if (!source) {
      view = { type: 'idle' }
      renderCaller()
      return
    }
    const resident = source.residentId ? findResident(source.residentId) : residentOfLine(source.line)
    const active = isCallback || source.accepted === true
    const tickets = resident ? ticketsOf(resident.id) : []
    const name = resident ? resident.name : 'Новый житель'
    const meta = resident
      ? resident.street + ' · ' + resident.line
      : 'На линии ' + source.line + ' карточки ещё нет'

    let list
    if (!active) {
      list = '<p class="hint">Примите звонок, чтобы увидеть обращения жителя.</p>'
    } else if (tickets.length) {
      list = '<div class="ticket-rows">' + tickets.map(function (ticket) {
        return ticketRow(ticket, true)
      }).join('') + '</div>'
    } else {
      list = '<p class="hint">' + (resident
        ? 'Обращений у жителя пока нет.'
        : 'Обращений нет: карточки жителя ещё нет.') + '</p>'
    }

    let actions
    if (!active) {
      actions = '<div class="actions">' +
        '<button type="button" class="btn primary" data-action="accept" data-call="' + esc(source.id) + '">Принять</button>' +
        '<button type="button" class="btn ghost" data-action="reject" data-call="' + esc(source.id) + '">Не ответил</button>' +
        '</div>'
    } else {
      const form = resident
        ? '<form class="form" data-form="new-ticket">' +
          '<label class="field"><span>Новое обращение</span>' +
          '<input name="subject" required minlength="3" placeholder="Например, заедает калитка"></label>' +
          '<button type="submit" class="btn">Создать обращение и записать звонок</button>' +
          '</form>'
        : '<form class="form" data-form="new-resident">' +
          '<p class="label">Новый житель</p>' +
          '<label class="field"><span>Имя</span><input name="name" required minlength="2" placeholder="Например, Ирина С."></label>' +
          '<label class="field"><span>Улица</span><input name="street" required minlength="2" placeholder="Например, Озёрная"></label>' +
          '<label class="field"><span>Тема обращения</span><input name="subject" required minlength="3" placeholder="Например, заедает калитка"></label>' +
          '<button type="submit" class="btn primary">Создать карточку и обращение</button>' +
          '</form>'
      actions = form + '<div class="actions">' +
        '<button type="button" class="btn ghost" data-action="record-none">Записать без обращения</button>' +
        '<button type="button" class="btn ghost" data-action="hold">Отложить</button>' +
        '</div>'
    }

    els.caller.innerHTML = '<div class="panel-head"><h2>' + (isCallback ? 'Обратный звонок' : 'Входящий звонок') + '</h2>' +
      '<span class="line">' + esc(source.line) + '</span></div>' +
      '<div class="caller-name"><strong>' + esc(name) + '</strong>' +
      '<span class="hint">' + esc(meta) + '</span></div>' +
      (source.text
        ? '<p class="quote">«' + esc(source.text) + '»</p>'
        : '<p class="hint">Повод звонка не записан.</p>') +
      (active ? '<div class="block-label">Обращения жителя</div>' : '') + list + actions
  }

  function renderTicket() {
    const ticket = selectedTicketId ? findTicket(selectedTicketId) : null
    if (!ticket) {
      els.ticket.innerHTML = '<div class="panel-head"><h2>Обращение</h2></div>' +
        '<p class="hint">Выберите обращение в списке жителя или в журнале.</p>'
      return
    }
    const resident = findResident(ticket.residentId)
    const worker = findWorker(ticket.workerId)
    const calls = callsOf(ticket.id).slice().sort(function (a, b) {
      return timeValue(a.at) - timeValue(b.at)
    })
    const callItems = calls.length
      ? calls.map(function (call) {
        return '<li><span class="time">' + esc(formatTime(call.at)) + '</span>' +
          '<span class="line">' + esc(call.line) + '</span>' +
          outcomeBadge(call.outcome) +
          (call.text ? '<span>' + esc('«' + call.text + '»') + '</span>' : '') +
          '</li>'
      }).join('')
      : '<li class="hint">Звонков по обращению нет.</li>'
    const workerButtons = ticket.status !== STATUS_DONE && !worker && state.workers.length
      ? '<div class="actions">' + state.workers.map(function (item) {
        return '<button type="button" class="btn small" data-action="assign" data-ticket="' + esc(ticket.id) +
          '" data-worker="' + esc(item.id) + '">Передать: ' + esc(item.name) + ' · ' + esc(item.role) + '</button>'
      }).join('') + '</div>'
      : ''
    const resultBlock = ticket.status === STATUS_DONE
      ? '<div class="result"><span class="label">Результат работ</span><p>' +
        esc(ticket.result || 'не записан') + '</p></div>'
      : !worker
        ? '<p class="hint">Передайте обращение исполнителю, чтобы записать результат работ.</p>'
        : '<label class="field"><span>Результат работ</span>' +
          '<textarea data-result="' + esc(ticket.id) + '" rows="3" placeholder="Что сделали и когда"></textarea></label>' +
          '<div class="actions"><button type="button" class="btn primary" data-action="complete" data-ticket="' +
          esc(ticket.id) + '">Завершить</button></div>'

    els.ticket.innerHTML = '<div class="panel-head"><h2>Обращение</h2>' +
      '<button type="button" class="btn ghost small" data-action="close-ticket">Закрыть</button></div>' +
      '<h3>#' + esc(ticket.id) + ' · ' + esc(ticket.subject) + '</h3>' +
      '<div class="facts">' +
      '<div><span class="label">Житель</span><span>' +
      esc(resident ? resident.name + ' · ' + resident.street + ' · ' + resident.line : 'не указан') +
      '</span></div>' +
      '<div><span class="label">Создано</span><span>' + esc(formatTime(ticket.createdAt)) + '</span></div>' +
      '<div><span class="label">Статус</span><span>' + statusBadge(ticket.status) + '</span></div>' +
      '<div><span class="label">Звонков</span><span>' + calls.length + '</span></div>' +
      '</div>' +
      '<div class="fact-line"><span class="label">Исполнитель</span><span>' +
      (worker ? esc(worker.name + ' · ' + worker.role) : 'не назначен') +
      '</span></div>' + workerButtons +
      '<div class="block-label">Звонки по обращению</div>' +
      '<ul class="calls">' + callItems + '</ul>' + resultBlock
  }

  function renderJournal() {
    const calls = state.calls.slice().sort(function (a, b) {
      return timeValue(b.at) - timeValue(a.at)
    })
    const items = calls.length
      ? calls.map(function (call) {
        const ticket = call.ticketId ? findTicket(call.ticketId) : null
        const link = ticket
          ? '<button type="button" class="link" data-action="open-ticket" data-ticket="' +
            esc(ticket.id) + '">#' + esc(ticket.id) + '</button>'
          : '<span class="hint">без обращения</span>'
        return '<li><span class="time">' + esc(formatTime(call.at)) + '</span>' +
          '<span class="line">' + esc(call.line) + '</span>' +
          '<span>' + esc(nameFor(call)) + (call.by ? ' · ' + esc(call.by) : '') + '</span>' +
          outcomeBadge(call.outcome) +
          '<span>' + link + '</span></li>'
      }).join('')
      : '<li class="hint">Звонков ещё не было.</li>'
    els.journal.innerHTML = '<div class="panel-head"><h2>Журнал звонков</h2>' +
      '<span class="count">' + calls.length + '</span></div>' +
      '<ul class="journal">' + items + '</ul>'
  }

  function simulate(line) {
    if (state.usedLines.indexOf(line) >= 0) return
    if (missedQueue().some(function (call) { return call.line === line })) return
    const resident = residentOfLine(line)
    const examples = (window.villageData && window.villageData.incomingExamples) || []
    const example = examples.find(function (item) { return item.line === line })
    let text = example ? example.text : ''
    if (!text) {
      text = resident
        ? 'Здравствуйте, это ' + resident.name.replace(/\.$/, '') + '. Есть вопрос по посёлку.'
        : 'Здравствуйте, я недавно переехал. Есть вопрос по посёлку.'
    }
    const call = {
      id: nextCallId(),
      at: nowIso(),
      line: line,
      residentId: resident ? resident.id : null,
      text: text
    }
    state.usedLines.push(line)
    state.queue.push(call)
    if (!state.current) {
      view = { type: 'incoming', callId: call.id }
    }
    notice = null
    save()
    render()
  }

  function openCall(callId) {
    const call = findQueueCall(callId)
    if (!call) return
    if (!call.accepted && state.current) return
    view = { type: 'incoming', callId: call.id }
    notice = null
    render()
  }

  function acceptCall(callId) {
    const call = findQueueCall(callId)
    if (!call || call.accepted || state.current) return
    state.queue = state.queue.filter(function (item) { return item.id !== call.id })
    call.accepted = true
    state.current = call
    view = { type: 'incoming', callId: call.id }
    const resident = call.residentId ? findResident(call.residentId) : residentOfLine(call.line)
    if (resident) {
      const tickets = ticketsOf(resident.id)
      if (tickets.length) selectedTicketId = tickets[0].id
    }
    notice = null
    save()
    render()
  }

  function holdCall() {
    view = { type: 'idle' }
    notice = null
    render()
  }

  function rejectCall(callId) {
    const call = findQueueCall(callId)
    if (!call || call.accepted) return
    state.calls.push({
      id: call.id,
      at: call.at,
      line: call.line,
      residentId: call.residentId || null,
      ticketId: null,
      outcome: OUTCOME_MISSED,
      text: call.text || '',
      by: account ? account.name : '',
      resolvedBy: null
    })
    state.queue = state.queue.filter(function (item) { return item.id !== call.id })
    view = { type: 'idle' }
    notice = null
    save()
    render()
  }

  function startCallback(callId) {
    const call = findCall(callId)
    if (!call) return
    view = { type: 'callback', callId: call.id }
    const resident = call.residentId ? findResident(call.residentId) : residentOfLine(call.line)
    if (resident) {
      const tickets = ticketsOf(resident.id)
      if (tickets.length) selectedTicketId = tickets[0].id
    }
    notice = null
    render()
  }

  function record(ticketId) {
    const isCallback = view.type === 'callback'
    const source = isCallback ? findCall(view.callId) : findQueueCall(view.callId)
    if (!source) return
    if (!isCallback && source.accepted !== true) return
    const resident = source.residentId ? findResident(source.residentId) : residentOfLine(source.line)
    const at = nowIso()
    const call = {
      id: isCallback ? nextId('c', state.calls) : source.id,
      at: at,
      line: source.line,
      residentId: resident ? resident.id : null,
      ticketId: ticketId,
      outcome: isCallback ? OUTCOME_CALLBACK : OUTCOME_ACCEPTED,
      text: source.text || '',
      by: account ? account.name : '',
      resolvedBy: null
    }
    if (isCallback) {
      state.calls.push(call)
      source.resolvedBy = call.id
    } else {
      state.calls.push(call)
      state.current = null
    }
    if (ticketId) {
      const ticket = findTicket(ticketId)
      if (ticket) {
        ticket.updatedAt = at
        selectedTicketId = ticket.id
      }
    }
    view = { type: 'idle' }
    notice = null
    save()
    render()
  }

  function createTicket(residentId, subject) {
    const at = nowIso()
    const ticket = {
      id: nextId('t', state.tickets),
      residentId: residentId,
      subject: subject,
      createdAt: at,
      updatedAt: at,
      status: STATUS_OPEN,
      workerId: null,
      result: ''
    }
    state.tickets.push(ticket)
    return ticket
  }

  function createTicketForResident(subject) {
    const isCallback = view.type === 'callback'
    const source = isCallback ? findCall(view.callId) : findQueueCall(view.callId)
    if (!source) return
    const resident = source.residentId ? findResident(source.residentId) : residentOfLine(source.line)
    const text = String(subject || '').trim()
    if (!resident || !text) return
    const ticket = createTicket(resident.id, text)
    record(ticket.id)
  }

  function createResidentAndTicket(values) {
    const isCallback = view.type === 'callback'
    const source = isCallback ? findCall(view.callId) : findQueueCall(view.callId)
    if (!source) return
    const name = String(values.name || '').trim()
    const street = String(values.street || '').trim()
    const subject = String(values.subject || '').trim()
    if (!name || !street || !subject) return
    const resident = {
      id: nextId('r', state.residents),
      name: name,
      line: source.line,
      street: street
    }
    state.residents.push(resident)
    source.residentId = resident.id
    const ticket = createTicket(resident.id, subject)
    record(ticket.id)
  }

  function assignWorker(ticketId, workerId) {
    const ticket = findTicket(ticketId)
    const worker = findWorker(workerId)
    if (!ticket || !worker || ticket.status === STATUS_DONE) return
    ticket.workerId = worker.id
    ticket.status = STATUS_PROGRESS
    ticket.updatedAt = nowIso()
    notice = null
    save()
    render()
  }

  function completeTicket(ticketId) {
    const ticket = findTicket(ticketId)
    if (!ticket) return
    if (!ticket.workerId) {
      notice = { kind: 'error', text: 'Сначала передайте обращение исполнителю.' }
      render()
      return
    }
    const field = document.querySelector('[data-result="' + ticketId + '"]')
    const result = field ? field.value.trim() : ''
    if (!result) {
      notice = { kind: 'error', text: 'Запишите результат работ, прежде чем завершать обращение.' }
      render()
      return
    }
    ticket.result = result
    ticket.status = STATUS_DONE
    ticket.updatedAt = nowIso()
    notice = null
    save()
    render()
  }

  async function resetDemo() {
    await saveChain
    let result = null
    try {
      result = await api('/api/reset', { method: 'POST' })
    } catch (error) {
      notice = { kind: 'error', text: 'Сервер не отвечает, сбросить данные не удалось.' }
      render()
      return
    }
    if (result.response.status === 401) {
      showLogin('Сессия завершилась. Войдите снова.')
      return
    }
    if (!result.response.ok || !result.data) {
      notice = { kind: 'error', text: 'Не удалось сбросить данные.' }
      render()
      return
    }
    state = normalize(result.data.state)
    version = result.data.version
    view = { type: 'idle' }
    selectedTicketId = null
    notice = null
    render()
  }

  document.addEventListener('click', function (event) {
    const trigger = event.target.closest('[data-action]')
    if (!trigger || !state) return
    const action = trigger.dataset.action
    if (action === 'simulate') simulate(trigger.dataset.line)
    else if (action === 'open-call') openCall(trigger.dataset.call)
    else if (action === 'accept') acceptCall(trigger.dataset.call)
    else if (action === 'reject') rejectCall(trigger.dataset.call)
    else if (action === 'hold') holdCall()
    else if (action === 'record') record(trigger.dataset.ticket)
    else if (action === 'record-none') record(null)
    else if (action === 'callback') startCallback(trigger.dataset.call)
    else if (action === 'open-ticket') {
      selectedTicketId = trigger.dataset.ticket
      notice = null
      render()
    } else if (action === 'close-ticket') {
      selectedTicketId = null
      render()
    } else if (action === 'assign') {
      assignWorker(trigger.dataset.ticket, trigger.dataset.worker)
    } else if (action === 'complete') {
      completeTicket(trigger.dataset.ticket)
    } else if (action === 'reset') {
      notice = { kind: 'confirm', text: 'Сбросить демо-данные и вернуть исходные записи?' }
      renderNotice()
    } else if (action === 'reset-confirm') {
      resetDemo()
    } else if (action === 'notice-close') {
      notice = null
      renderNotice()
    } else if (action === 'logout') {
      logout()
    }
  })

  document.addEventListener('submit', function (event) {
    const form = event.target.closest('[data-form]')
    if (!form || !state) return
    event.preventDefault()
    const data = new FormData(form)
    if (form.dataset.form === 'new-ticket') {
      createTicketForResident(data.get('subject'))
    } else if (form.dataset.form === 'new-resident') {
      createResidentAndTicket({
        name: data.get('name'),
        street: data.get('street'),
        subject: data.get('subject')
      })
    }
  })

  els.loginForm.addEventListener('submit', function (event) {
    event.preventDefault()
    submitLogin(els.loginForm)
  })

  boot()
})()
