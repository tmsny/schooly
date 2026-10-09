import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function loadPage(fileName) {
  const filePath = path.join(projectRoot, fileName);
  const html = await readFile(filePath, 'utf8');
  return new JSDOM(html, { url: pathToFileURL(filePath).href }).window.document;
}

test('start page shows its main content and links to sign-in', async () => {
  const document = await loadPage('index.html');

  assert.match(document.title, /Schooly/);
  assert.match(document.querySelector('main h1')?.textContent ?? '', /Weniger Chaos/);
  assert.ok(document.querySelector('#funktionen'));
  assert.ok(document.querySelector('#klassen'));
  assert.ok(document.querySelector('a[href="login.html"]'));
});

test('app shell has its core containers and all local scripts', async () => {
  const document = await loadPage('app.html');

  assert.ok(document.querySelector('nav#nav'));
  assert.ok(document.querySelector('main#view'));
  assert.ok(document.querySelector('dialog#dlg'));
  assert.ok(document.querySelector('#toasts[aria-live="polite"]'));

  const localScripts = [...document.querySelectorAll('script[src]')]
    .map((script) => script.getAttribute('src'))
    .filter((src) => src && !/^https?:\/\//.test(src));

  assert.ok(localScripts.length > 0, 'app.html should load local JavaScript files');
  await Promise.all(localScripts.map((src) => access(path.join(projectRoot, src))));
});

test('login page has email and password fields', async () => {
  const document = await loadPage('login.html');

  assert.ok(document.querySelector('form#email-form'));
  assert.equal(document.querySelector('input#email')?.type, 'email');
  assert.equal(document.querySelector('input#password')?.type, 'password');
  assert.ok(document.querySelector('button#google-signin'));
});
