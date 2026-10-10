import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const timerSource = await readFile(path.join(projectRoot, 'js', 'timer.js'), 'utf8');

function createTimer(initialState) {
  const dom = new JSDOM('<!doctype html><html><body><div id="toasts"></div></body></html>', {
    runScripts: 'outside-only',
    url: 'https://schooly.test'
  });
  const { window } = dom;
  let now = 1000, nextInterval = 0;
  const intervals = new Map(), notifications = [];
  window.Date.now = () => now;
  window.setInterval = (callback) => {
    const id = ++nextInterval;
    intervals.set(id, callback);
    return id;
  };
  window.clearInterval = (id) => intervals.delete(id);
  window.HM = { U: { toast: (message) => notifications.push(message) } };
  if (initialState) window.localStorage.setItem('hm.timer.v1', JSON.stringify(initialState));
  window.eval(timerSource);
  const view = window.document.createElement('main');
  view.innerHTML = window.HM.Timer.render();
  window.document.body.appendChild(view);
  return {
    dom, window, view, intervals, notifications,
    advance(milliseconds) { now += milliseconds; },
    click(selector) { view.querySelector(selector).dispatchEvent(new window.Event('click', { bubbles: true })); },
    change(selector) { view.querySelector(selector).dispatchEvent(new window.Event('change', { bubbles: true })); }
  };
}

test('timer offers the normal and flight styles', () => {
  const timer = createTimer();
  assert.match(timer.view.querySelector('#timer-display').textContent, /25:00/);
  assert.equal(timer.view.querySelectorAll('.timer-mode').length, 2);
  assert.equal(timer.view.querySelector('[data-type="flip"]'), null);
  assert.equal(timer.view.querySelectorAll('.flip-digit').length, 0);

  timer.click('[data-type="flight"]');
  assert.ok(timer.view.querySelector('#flight-card').classList.contains('active'));
  assert.equal(timer.view.querySelector('#timer-title').textContent, 'Auf nach Tokio');
  assert.equal(timer.view.querySelector('#flight-progress-bar').getAttribute('aria-valuenow'), '0');
  timer.dom.window.close();
});

test('saved flip clocks migrate to the normal display', () => {
  const timer = createTimer({ type: 'flip', durationMs: 120000, remainingMs: 90000, running: false });
  assert.match(timer.view.querySelector('#timer-display').textContent, /01:30/);
  const migrated = JSON.parse(timer.window.localStorage.getItem('hm.timer.v1'));
  assert.equal(migrated.type, 'normal');
  assert.equal(migrated.remainingMs, 90000);
  timer.dom.window.close();
});

test('timer pauses and finishes the flight at its destination', () => {
  const timer = createTimer();
  timer.click('[data-type="flight"]');
  timer.view.querySelector('#timer-minutes').value = '1';
  timer.change('#timer-minutes');
  timer.click('#timer-toggle');

  assert.equal(JSON.parse(timer.window.localStorage.getItem('hm.timer.v1')).running, true);
  timer.advance(20_000);
  for (const callback of timer.intervals.values()) callback();
  assert.notEqual(timer.view.querySelector('#flight-plane').getAttribute('transform'), 'translate(210 168) rotate(-30)');
  assert.equal(timer.view.querySelector('#flight-progress-bar').getAttribute('aria-valuenow'), '33');
  timer.click('#timer-toggle');
  assert.equal(JSON.parse(timer.window.localStorage.getItem('hm.timer.v1')).running, false);
  assert.equal(timer.view.querySelector('#flight-status').textContent, 'Pausiert');
  assert.equal(timer.view.querySelector('#flight-arrival').textContent, '33% der Strecke');
  timer.click('#timer-toggle');
  timer.advance(40_000);
  for (const callback of timer.intervals.values()) callback();

  assert.equal(timer.view.querySelector('#flight-status').textContent, 'Angekommen!');
  assert.equal(timer.view.querySelector('#flight-arrival').textContent, 'Du bist in Tokio gelandet');
  assert.match(timer.view.querySelector('#flight-plane').getAttribute('transform'), /translate\(630\.0 174\.0\)/);
  assert.equal(timer.view.querySelector('#flight-progress-bar').getAttribute('aria-valuenow'), '100');
  assert.match(timer.notifications.at(-1), /Tokio angekommen/);
  assert.equal(JSON.parse(timer.window.localStorage.getItem('hm.timer.v1')).completed, true);
  timer.dom.window.close();
});
