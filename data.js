// Вымышленные записи для двух смен. Время — местное, линии не являются номерами.
window.villageData = {
  residents: [
    { id: 'r-1', name: 'Мария В.', line: 'ЛИНИЯ-А', street: 'Липовая' },
    { id: 'r-2', name: 'Антон К.', line: 'ЛИНИЯ-Б', street: 'Садовая' }
  ],
  workers: [{ id: 'w-1', name: 'Глеб П.', role: 'Электрик' }],
  tickets: [
    { id: 't-1', residentId: 'r-1', subject: 'Не горят два фонаря на Липовой', createdAt: '2026-11-10T18:20', status: 'Открыто', workerId: null }
  ],
  calls: [
    { id: 'c-1', at: '2026-11-10T18:17', line: 'ЛИНИЯ-А', residentId: 'r-1', ticketId: 't-1', outcome: 'Принят' },
    { id: 'c-2', at: '2026-11-11T08:55', line: 'ЛИНИЯ-Б', residentId: 'r-2', ticketId: null, outcome: 'Пропущен' }
  ],
  incomingExamples: [
    { line: 'ЛИНИЯ-А', text: 'Вчера звонили про фонари. Уже починили?' },
    { line: 'ЛИНИЯ-В', text: 'Я недавно переехал. Заедает калитка у площадки.' }
  ]
}
