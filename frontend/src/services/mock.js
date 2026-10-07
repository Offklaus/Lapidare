/* Dados de exemplo no formato do contrato da API.
   Servem só enquanto o back-end não existe (VITE_USE_MOCK=true).
   Nomes e preços são fictícios: troque pelos reais no back-end. */
import { toISODate, parseISODate } from '../lib/format.js';

const SERVICES = [
  { id: 'manicure', category: 'Unhas', name: 'Manicure tradicional', description: 'Cutilagem, lixa e esmaltação.', duration: 45, price: 45 },
  { id: 'pedicure', category: 'Unhas', name: 'Pedicure', description: 'Cutilagem, lixa e esmaltação dos pés.', duration: 60, price: 55 },
  { id: 'esmaltacao-gel', category: 'Unhas', name: 'Esmaltação em gel', description: 'Brilho e duração de até 3 semanas.', duration: 60, price: 90 },
  { id: 'alongamento-gel', category: 'Alongamento', name: 'Alongamento em gel', description: 'Aplicação completa com formato à sua escolha.', duration: 150, price: 180 },
  { id: 'manutencao-gel', category: 'Alongamento', name: 'Manutenção do alongamento', description: 'Para quem já tem o alongamento feito aqui.', duration: 90, price: 120 },
  { id: 'design-sobrancelha', category: 'Sobrancelhas', name: 'Design de sobrancelhas', description: 'Mapeamento e design com pinça.', duration: 40, price: 50 },
  { id: 'brow-lamination', category: 'Sobrancelhas', name: 'Brow lamination', description: 'Fios alinhados e volume natural.', duration: 60, price: 130 },
  { id: 'lash-lifting', category: 'Cílios', name: 'Lash lifting', description: 'Curvatura dos fios naturais.', duration: 60, price: 140 },
  { id: 'extensao-cilios', category: 'Cílios', name: 'Extensão de cílios fio a fio', description: 'Efeito natural, fio a fio.', duration: 120, price: 200 },
  { id: 'nano-sobrancelha', category: 'Nanopigmentação', name: 'Nanopigmentação de sobrancelhas', description: 'Fios desenhados, resultado natural.', duration: 150, price: 450 },
  { id: 'laser-axila', category: 'Laser', name: 'Depilação a laser — axilas', description: 'Sessão avulsa.', duration: 20, price: 80 },
];

const PROFESSIONALS = [
  { id: 'pro-1', name: 'Profissional Um', role: 'Nail designer', specialties: ['Unhas', 'Alongamento'], photo: null },
  { id: 'pro-2', name: 'Profissional Dois', role: 'Designer de sobrancelhas e cílios', specialties: ['Sobrancelhas', 'Cílios', 'Nanopigmentação'], photo: null },
  { id: 'pro-3', name: 'Profissional Três', role: 'Esteticista', specialties: ['Laser', 'Sobrancelhas', 'Unhas'], photo: null },
];

const OPEN = 9 * 60; // 09:00
const CLOSE = 19 * 60; // 19:00
const STEP = 30;

const bookings = []; // reservas feitas nesta sessão do navegador

const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

/* Pseudo-aleatório estável: o mesmo dia/profissional sempre gera a mesma agenda. */
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
}

const toTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Serviços escolhidos (na ordem); [] se algum não existe. */
function servicesFor(serviceIds = []) {
  const list = serviceIds.map((id) => SERVICES.find((s) => s.id === id));
  return list.length && list.every(Boolean) ? list : [];
}

/** Quem faz TODOS os serviços (vários serviços = em sequência, com a mesma profissional). */
function prosFor(serviceIds) {
  const services = servicesFor(serviceIds);
  if (!services.length) return [];
  return PROFESSIONALS.filter((p) => services.every((s) => p.specialties.includes(s.category)));
}

const totalOf = (services) => ({
  duration: services.reduce((sum, s) => sum + s.duration, 0),
  price: services.reduce((sum, s) => sum + s.price, 0),
});

function slotsForPro(service, proId, date) {
  const dt = parseISODate(date);
  if (dt.getDay() === 0) return []; // domingo: fechado
  const rand = seeded(`${date}:${proId}`);
  const today = toISODate(new Date());
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const list = [];
  for (let start = OPEN; start + service.duration <= CLOSE; start += STEP) {
    const time = toTime(start);
    let status = rand() < 0.3 ? 'booked' : 'available';
    if (date === today && start <= nowMin) status = 'blocked';
    if (bookings.some((b) => b.professionalId === proId && b.date === date && b.time === time)) status = 'booked';
    list.push({ time, status, professionalId: proId });
  }
  return list;
}

function slotsFor({ serviceIds, professionalId = 'any', date }) {
  const services = servicesFor(serviceIds);
  if (!services.length) return [];
  const service = totalOf(services); // a sequência inteira precisa caber
  const pros = prosFor(serviceIds).filter((p) => professionalId === 'any' || p.id === professionalId);

  // "Primeiro horário livre": junta as agendas e fica com a primeira profissional livre em cada horário.
  const byTime = new Map();
  pros.forEach((p) => {
    slotsForPro(service, p.id, date).forEach((slot) => {
      const current = byTime.get(slot.time);
      if (!current || (current.status !== 'available' && slot.status === 'available')) byTime.set(slot.time, slot);
    });
  });
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
}

export async function getServices(professionalId) {
  await delay();
  const pro = PROFESSIONALS.find((p) => p.id === professionalId);
  const list = pro ? SERVICES.filter((s) => pro.specialties.includes(s.category)) : SERVICES;
  return list.map((s) => ({ ...s }));
}

export async function getProfessionals(serviceIds = []) {
  await delay();
  // Sem serviço (1ª etapa do agendamento: profissional primeiro), todas; com serviços, só quem faz todos.
  const list = serviceIds.length ? prosFor(serviceIds) : PROFESSIONALS;
  return list.map((p) => ({ ...p }));
}

export async function getSlots(params) {
  await delay();
  return slotsFor(params);
}

export async function getAvailability({ serviceIds, professionalId = 'any', from, days = 14 }) {
  await delay();
  const start = from ? parseISODate(from) : new Date();
  const result = [];
  for (let i = 0; i < days; i += 1) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const date = toISODate(dt);
    const slots = slotsFor({ serviceIds, professionalId, date });
    result.push({ date, available: slots.some((s) => s.status === 'available') });
  }
  return { days: result };
}

export async function createBooking({ serviceIds, serviceId, professionalId, date, time, customer }) {
  await delay(600);
  const taken = bookings.some((b) => b.professionalId === professionalId && b.date === date && b.time === time);
  if (taken) {
    const err = new Error('Esse horário acabou de ser reservado. Escolha outro abaixo.');
    err.status = 409;
    throw err;
  }
  const booking = {
    id: `bk_${Date.now().toString(36)}`,
    code: randomCode(),
    serviceIds: serviceIds?.length ? serviceIds : [serviceId],
    professionalId,
    date,
    time,
    customer,
    status: 'confirmed',
  };
  bookings.push(booking);
  return { id: booking.id, code: booking.code, status: booking.status };
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode() {
  const c = Array.from({ length: 8 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

export async function getBooking(code) {
  await delay();
  const booking = bookings.find((b) => b.code === code);
  if (!booking) {
    const err = new Error('Não encontramos agendamento com esse código. Confira as letras e os números.');
    err.status = 404;
    throw err;
  }
  return publicBooking(booking);
}

const CANCEL_MIN_HOURS = 24;

function publicBooking(booking) {
  const list = servicesFor(booking.serviceIds);
  const service = totalOf(list);
  const pro = PROFESSIONALS.find((p) => p.id === booking.professionalId);
  const [h, m] = booking.time.split(':').map(Number);
  const start = parseISODate(booking.date);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + service.duration * 60000);
  const deadline = new Date(start.getTime() - CANCEL_MIN_HOURS * 3600000);
  const active = booking.status === 'confirmed' || booking.status === 'pending';
  return {
    code: booking.code,
    status: booking.status,
    date: booking.date,
    time: booking.time,
    isPast: end < new Date(),
    customerFirstName: booking.customer.name.split(' ')[0],
    service: { name: list.map((s) => s.name).join(' + '), duration: service.duration, price: service.price },
    services: list.reduce((acc, s) => {
      const at = acc.length ? acc[acc.length - 1].end : h * 60 + m;
      return [...acc, { name: s.name, duration: s.duration, price: s.price, time: toTime(at), end: at + s.duration }];
    }, []).map(({ end, ...s }) => s),
    professional: { name: pro.name },
    cancellation: {
      allowed: active && new Date() <= deadline,
      deadline: {
        date: toISODate(deadline),
        time: `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`,
      },
      minHours: CANCEL_MIN_HOURS,
    },
  };
}

export async function cancelBooking(code, phoneLast4) {
  await delay(500);
  const booking = bookings.find((b) => b.code === code);
  const fail = (status, message) => Object.assign(new Error(message), { status });
  if (!booking) throw fail(404, 'Não encontramos agendamento com esse código. Confira as letras e os números.');
  if (!booking.customer.phone.endsWith(phoneLast4)) {
    throw fail(403, 'Os 4 últimos dígitos não conferem com o WhatsApp usado no agendamento. Confira e tente de novo.');
  }
  const view = publicBooking(booking);
  if (booking.status === 'cancelled') throw fail(409, 'Este agendamento já estava cancelado.');
  if (!view.cancellation.allowed) {
    throw fail(409, `Faltam menos de ${CANCEL_MIN_HOURS} h para o seu horário. Para cancelar ou remarcar, fale com o salão.`);
  }
  booking.status = 'cancelled';
  return publicBooking(booking);
}
