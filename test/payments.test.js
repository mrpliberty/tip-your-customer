import test from 'node:test';
import assert from 'node:assert/strict';
import { bech32 } from 'bech32';
import { dollarsToCents, cashAppLink, lightningAddress, lnurlEncode, centsToMillisats, validateLnurlMetadata, validateInvoice, requestInvoice, fetchRate } from '../src/payments.js';

const reject = (fn, message) => assert.throws(fn, { message });
test('USD cents are parsed exactly; invalid amounts rejected', () => {
  assert.equal(dollarsToCents('0.01'), 1);
  assert.equal(dollarsToCents('25.5'), 2550);
  assert.equal(dollarsToCents('9999.99'), 999999);
  for (const amount of ['0', '-1', '1.234', '1e6', '10000', 'Infinity', '']) assert.throws(() => dollarsToCents(amount));
});
test('Cash App QR uses official recipient link without asserting amount prefill', () => {
  assert.deepEqual(cashAppLink(' $JaneDoe '), { handle: '$JaneDoe', url: 'https://cash.app/$JaneDoe' });
  for (const bad of ['a/b', 'https://evil.test', 'a?amount=200', '', '2name']) assert.throws(() => cashAppLink(bad));
});
test('Lightning address URL and LNURL QR round trip', () => {
  const address = lightningAddress('Alice@Example.com');
  assert.equal(address.url, 'https://example.com/.well-known/lnurlp/Alice');
  const encoded = lnurlEncode(address.url);
  const decoded = new TextDecoder().decode(new Uint8Array(bech32.fromWords(bech32.decode(encoded.toLowerCase(), 2000).words)));
  assert.equal(decoded, address.url);
  for (const bad of ['localhost', 'x@localhost', 'x@-domain.com', 'x@domain..com', 'x@domain.com/path']) assert.throws(() => lightningAddress(bad));
});
test('exchange rate conversion and recipient limits', () => {
  assert.equal(centsToMillisats(100, 100000), 1000000);
  reject(() => centsToMillisats(100, 0), 'The Bitcoin exchange rate is unavailable.');
  assert.equal(validateLnurlMetadata({ tag: 'payRequest', callback: 'https://example.com/pay', minSendable: 1000, maxSendable: 2000000 }, 1000000).hostname, 'example.com');
  assert.throws(() => validateLnurlMetadata({ tag: 'payRequest', callback: 'http://example.com', minSendable: 1000, maxSendable: 2000000 }, 1000000));
  assert.throws(() => validateLnurlMetadata({ tag: 'payRequest', callback: 'https://example.com', minSendable: 1000, maxSendable: 2000000 }, 2000001));
});
test('live-rate parser fails closed on malformed response', async () => {
  assert.equal(await fetchRate(async () => ({ ok: true, json: async () => ({ data: { amount: '100000' } }) })), 100000);
  await assert.rejects(fetchRate(async () => ({ ok: true, json: async () => ({ data: { amount: 'NaN' } }) })));
});
test('invoice callback requests correct millisats and checks returned amount', async () => {
  const pr = `lnbc10u1${'q'.repeat(65)}`;
  const urls = [];
  const fetcher = async url => {
    urls.push(url);
    return { ok: true, json: async () => urls.length === 1
      ? { tag: 'payRequest', callback: 'https://example.com/callback?foo=bar', minSendable: 1000, maxSendable: 2000000 }
      : { pr } };
  };
  const invoice = await requestInvoice(lightningAddress('alice@example.com'), 1000000, fetcher);
  assert.equal(invoice, pr);
  assert.equal(new URL(urls[1]).searchParams.get('amount'), '1000000');
  assert.throws(() => validateInvoice({ pr }, 2000000), /does not match/);
  assert.throws(() => validateInvoice({ pr: `lntb10u1${'q'.repeat(65)}` }, 1000000));
  assert.throws(() => validateInvoice({ pr: `lnbc1${'q'.repeat(65)}` }, 1000000));
});
