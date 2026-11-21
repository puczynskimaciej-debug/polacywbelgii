import { fail } from './common.mjs';

const sender = 'kontakt@polacywbelgii.eu';
export const adMailReady = env => Boolean(env.AD_SMTP_HOST && env.AD_SMTP_USER && env.AD_SMTP_PASSWORD);
const lines = {
  pl: {
    paid: 'Otrzymaliśmy płatność. Ogłoszenie czeka na sprawdzenie przez redakcję.',
    approved: 'Ogłoszenie zostało zatwierdzone i będzie wyświetlane zgodnie z wybranym terminem.',
    changes_requested: 'Prosimy o poprawienie ogłoszenia. Powód:',
    rejected: 'Ogłoszenie zostało odrzucone z powodu naruszenia regulaminu. Powód:',
    refund_requested: 'Zleciliśmy pełny zwrot płatności przez Stripe. Termin zaksięgowania zależy od banku.',
    corrected: 'Otrzymaliśmy poprawione ogłoszenie. Ponownie trafiło do moderacji.'
  },
  nl: {
    paid: 'We hebben uw betaling ontvangen. Uw advertentie wacht op redactionele controle.',
    approved: 'Uw advertentie is goedgekeurd en verschijnt volgens de gekozen planning.',
    changes_requested: 'Pas uw advertentie aan. Reden:',
    rejected: 'Uw advertentie is afgewezen wegens een overtreding van de voorwaarden. Reden:',
    refund_requested: 'We hebben via Stripe een volledige terugbetaling aangevraagd. De verwerkingstijd hangt af van uw bank.',
    corrected: 'We hebben uw aangepaste advertentie ontvangen. Deze wacht opnieuw op controle.'
  },
  fr: {
    paid: 'Nous avons reçu votre paiement. Votre annonce attend une vérification éditoriale.',
    approved: 'Votre annonce a été approuvée et sera affichée selon les dates choisies.',
    changes_requested: 'Veuillez corriger votre annonce. Motif :',
    rejected: 'Votre annonce a été refusée pour non-respect du règlement. Motif :',
    refund_requested: 'Nous avons demandé un remboursement intégral via Stripe. Le délai dépend de votre banque.',
    corrected: 'Nous avons reçu votre annonce corrigée. Elle est de nouveau en attente de vérification.'
  },
  en: {
    paid: 'We received your payment. Your advert is awaiting editorial review.',
    approved: 'Your advert was approved and will appear on the selected dates.',
    changes_requested: 'Please correct your advert. Reason:',
    rejected: 'Your advert was rejected for violating the terms. Reason:',
    refund_requested: 'We requested a full refund through Stripe. Your bank determines when it appears.',
    corrected: 'We received your corrected advert. It is awaiting review again.'
  }
};
const subjects = { paid: 'Płatność za ogłoszenie', approved: 'Ogłoszenie zatwierdzone', changes_requested: 'Prośba o poprawienie ogłoszenia', rejected: 'Ogłoszenie odrzucone', refund_requested: 'Zwrot za ogłoszenie', corrected: 'Poprawione ogłoszenie otrzymane' };
const b64 = value => btoa(String.fromCharCode(...new TextEncoder().encode(value)));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

export function adminOrderMessage(group, origin) {
  const order = group.find(item => item.language === item.primaryLanguage) || group[0];
  const reviewUrl = `${origin}/admin/?reviewAd=${encodeURIComponent(order.id)}`;
  const details = [
    ['Pakiet', order.type],
    ['Treść ogłoszenia', group.map(item => `${item.language.toUpperCase()}: ${item.title}\n${item.description || ''}`).join('\n\n')],
    ['Grafika', group.some(item => item.image || item.imageMobile || item.hasImage || item.hasMobileImage) ? `Podgląd w CMS: ${reviewUrl}` : 'Brak'],
    ['Reklamodawca', order.company || order.customerName || '—'],
    ['Kontakt publiczny', [order.publicPhone, order.publicEmail, order.contact].filter(Boolean).join(' · ') || '—'],
    ['Kontakt zamawiającego', [order.email, order.phone].filter(Boolean).join(' · ') || '—'],
    ['Okres emisji', `${order.startDate} – ${order.endDate}`],
    ['Kwota', `${new Intl.NumberFormat('pl-PL', { minimumFractionDigits:2, maximumFractionDigits:2 }).format(group.reduce((sum, item) => sum + item.totalPrice, 0) / 100)} EUR`],
    ['Płatność', order.paymentStatus === 'paid' ? 'Opłacone' : 'Oczekuje na płatność']
  ];
  const body = `Nowe zamówienie reklamowe\n\n${details.map(([label, value]) => `${label}: ${value}`).join('\n\n')}\n\nZatwierdź i opublikuj (wymaga zalogowania i potwierdzenia w CMS): ${reviewUrl}`;
  const html = `<h1>Nowe zamówienie reklamowe</h1>${details.map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong><br>${escapeHtml(value).replace(/\n/g, '<br>')}</p>`).join('')}<p><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;padding:12px 18px;background:#b92835;color:#fff;text-decoration:none;border-radius:6px">Zatwierdź i opublikuj</a></p><p>Link otwiera szczegóły w CMS. Zatwierdzenie wymaga zalogowania i osobnego potwierdzenia. Nieopłaconego zamówienia nie można opublikować.</p>`;
  return { to: sender, subject: `PolacywBelgii.eu — nowe zamówienie ${order.type}`, body, html };
}

export function adMessage(kind, order, { reason = '', editUrl = '' } = {}) {
  const language = lines[order.primaryLanguage || order.language] ? order.primaryLanguage || order.language : 'pl';
  const copy = lines[language][kind];
  if (!copy) fail('validation');
  const body = [
    'PolacywBelgii.eu', '', copy,
    reason && ['changes_requested', 'rejected'].includes(kind) ? reason : '',
    editUrl && kind === 'changes_requested' ? `Link do poprawienia / Edit link: ${editUrl}` : '',
    '', `Numer zamówienia / Order: ${order.groupId || order.id}`,
    `Kontakt / Contact: ${sender}`
  ].filter((line, index, all) => line || index < 2 || all[index - 1] !== '').join('\n');
  return { to: order.email, from: sender, subject: `PolacywBelgii.eu — ${subjects[kind]}`, body };
}

export async function sendAdEmail(env, message) {
  if (!adMailReady(env)) fail('mailConfiguration', 503);
  const host = env.AD_SMTP_HOST;
  if (!/^[a-z0-9.-]+$/i.test(host) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.AD_SMTP_USER)) fail('mailConfiguration', 503);
  const { connect } = await import('cloudflare:sockets');
  const socket = connect({ hostname: host, port: 465 }, { secureTransport: 'on' });
  const writer = socket.writable.getWriter(), reader = socket.readable.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const readLine = async () => {
    while (!buffer.includes('\r\n')) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('mailUnavailable');
      buffer += decoder.decode(chunk.value, { stream: true });
      if (buffer.length > 16000) throw new Error('mailUnavailable');
    }
    const end = buffer.indexOf('\r\n'), line = buffer.slice(0, end);
    buffer = buffer.slice(end + 2);
    return line;
  };
  const reply = async expected => {
    let line;
    do { line = await readLine(); } while (/^\d{3}-/.test(line));
    if (!line.startsWith(String(expected))) throw new Error('mailUnavailable');
  };
  const send = async (command, expected) => { await writer.write(new TextEncoder().encode(command + '\r\n')); await reply(expected); };
  try {
    await socket.opened;
    await reply(220);
    await send('EHLO polacywbelgii.eu', 250);
    await send('AUTH LOGIN', 334);
    await send(b64(env.AD_SMTP_USER), 334);
    await send(b64(env.AD_SMTP_PASSWORD), 235);
    await send(`MAIL FROM:<${env.AD_SMTP_USER}>`, 250);
    await send(`RCPT TO:<${message.to}>`, 250);
    await send('DATA', 354);
    const encodedBody = b64(message.body).match(/.{1,76}/g).join('\r\n');
    const boundary = `pbe-${crypto.randomUUID()}`;
    const encodedHtml = message.html ? b64(message.html).match(/.{1,76}/g).join('\r\n') : '';
    const mime = [
      `From: PolacywBelgii.eu <${env.AD_SMTP_USER}>`, `To: <${message.to}>`,
      `Subject: =?UTF-8?B?${b64(message.subject)}?=`, 'MIME-Version: 1.0',
      `Content-Type: ${message.html ? `multipart/alternative; boundary="${boundary}"` : 'text/plain; charset=UTF-8'}`,
      ...(message.html ? [] : ['Content-Transfer-Encoding: base64']),
      `Message-ID: <${crypto.randomUUID()}@polacywbelgii.eu>`, '',
      ...(message.html ? [`--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encodedBody, `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encodedHtml, `--${boundary}--`] : [encodedBody]), '.'
    ].join('\r\n');
    await send(mime, 250);
    await send('QUIT', 221);
  } catch { fail('mailUnavailable', 503); }
  finally { writer.releaseLock(); reader.releaseLock(); await socket.close().catch(() => {}); }
}
