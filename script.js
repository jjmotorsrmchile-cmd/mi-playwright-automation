import { firefox } from 'playwright';
import fs from 'fs';
import fetch from 'node-fetch';

(async () => {
  const LOGIN_PAGE = 'https://claims.chilena.cl/default.php';
  const USERNAME = '77000465-9';
  const PASSWORD = 'Diesel.757';
  const OUTPUT_FILE = 'cookies.json';
  const WEBHOOK_URL = 'https://hook.us2.make.com/g7om9qxjwqwpja6aeybykn97r6uhgbhq'; // <--- poné aquí tu webhook

  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Abriendo página de login en claims.chilena.cl...');
  await page.goto(LOGIN_PAGE, { waitUntil: 'domcontentloaded' });

  console.log('Esperando iframe de login...');
  await page.waitForSelector('#formulario', { timeout: 60000 });

  let frame = null;
  for (let i = 0; i < 30; i++) {
    frame = page.frames().find(f => f.name() === 'formulario' || f.url().includes('www11.chilena.cl'));
    if (frame) break;
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!frame) {
    console.error('No se encontró el iframe de login después de 30 segundos.');
    await browser.close();
    return;
  }

  console.log('Esperando campo de usuario dentro del iframe...');
  await frame.waitForSelector('#txtLogin', { timeout: 60000 });
  console.log('Campos detectados, completando credenciales...');

  await frame.fill('#txtLogin', USERNAME);
  await frame.fill('input[type="password"]', PASSWORD);

  console.log('Haciendo click en el enlace de login...');
  const btn = await frame.$('#btnLogin');
  if (btn) {
    await btn.click();
    console.log('Click realizado sobre #btnLogin.');
  }

  console.log('Esperando redirección a claims.chilena.cl...');
  await page.waitForURL(/claims\.chilena\.cl\/workflow_taller/, { timeout: 120000 });

  const cookies = await page.context().cookies();
  const filtered = cookies.filter(c => c.domain.includes('chilena.cl'));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(filtered, null, 2), 'utf-8');

  const cookieHeader = filtered.map(c => `${c.name}=${c.value}`).join('; ');
  console.log('\n🔑 HEADER PARA MAKE:\n');
  console.log(cookieHeader);

  const payload = {
    timestamp: new Date().toISOString(),
    cookie_header: cookieHeader,
    cookies: filtered
  };

  console.log('Enviando cookies al webhook de Make...');
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log('Respuesta de Make:', res.status, res.statusText);

  await browser.close();
})();
