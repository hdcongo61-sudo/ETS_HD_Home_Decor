const test = require('node:test');
const assert = require('node:assert/strict');
const { describeUserAgent, readTrustedLocation } = require('../utils/sessionMetadata');

test('describes a mobile Android Chrome session', () => {
  const metadata = describeUserAgent(
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'
  );
  assert.deepEqual(metadata, {
    deviceType: 'Mobile',
    operatingSystem: 'Android',
    browser: 'Chrome',
  });
});

test('describes an iPad Safari session as a tablet', () => {
  const metadata = describeUserAgent(
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
  );
  assert.deepEqual(metadata, {
    deviceType: 'Tablette',
    operatingSystem: 'iOS',
    browser: 'Safari',
  });
});

test('reads approximate location only from explicitly trusted proxy headers', () => {
  const headers = {
    'cf-ipcity': 'Brazzaville',
    'cf-region': 'Brazzaville',
    'cf-ipcountry': 'CG',
  };
  assert.equal(readTrustedLocation(headers, 'cloudflare'), 'Brazzaville, Brazzaville, CG');
  assert.equal(readTrustedLocation(headers, ''), '');
  assert.equal(readTrustedLocation(headers, 'unknown'), '');
});

test('supports Vercel location headers and bounds untrusted header values', () => {
  assert.equal(
    readTrustedLocation({
      'x-vercel-ip-city': 'Kinshasa',
      'x-vercel-ip-country-region': 'KN',
      'x-vercel-ip-country': 'CD',
    }, 'vercel'),
    'Kinshasa, KN, CD'
  );
  assert.equal(
    readTrustedLocation({ 'cf-ipcity': `${'A'.repeat(120)}\nInjected` }, 'cloudflare').length,
    100
  );
});
