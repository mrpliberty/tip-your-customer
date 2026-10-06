import { bech32 } from 'bech32';

export function dollarsToCents(input) {
  const value = String(input).trim();
  if (!/^(?:\d{1,4})(?:\.\d{1,2})?$/.test(value)) throw new Error('Enter an amount from $0.01 to $9,999.99.');
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents < 1 || cents > 999999) throw new Error('Enter an amount from $0.01 to $9,999.99.');
  return cents;
}

export function cashAppLink(handle) {
  const tag = String(handle).trim().replace(/^\$/, '');
  if (!/^[A-Za-z][A-Za-z0-9]{0,19}$/.test(tag)) throw new Error('Enter a valid Cash App $cashtag.');
  return { handle: `$${tag}`, url: `https://cash.app/$${tag}` };
}

export function lightningAddress(handle) {
  const text = String(handle).trim();
  const match = /^([a-zA-Z0-9._-]{1,64})@([a-zA-Z0-9.-]{1,253})$/.exec(text);
  if (!match || match[1].startsWith('.') || match[1].includes('..')) throw new Error('Enter a Lightning address, like name@domain.com.');
  const domain = match[2].toLowerCase();
  if (!domain.includes('.') || domain.endsWith('.') || domain.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('Enter a valid public Lightning address domain.');
  }
  return { address: `${match[1]}@${domain}`, url: `https://${domain}/.well-known/lnurlp/${encodeURIComponent(match[1])}` };
}

export function lnurlEncode(url) {
  const words = bech32.toWords(new TextEncoder().encode(url));
  return bech32.encode('lnurl', words, 2000).toUpperCase();
}

export function centsToMillisats(cents, usdPerBtc) {
  if (!Number.isFinite(usdPerBtc) || usdPerBtc <= 0) throw new Error('The Bitcoin exchange rate is unavailable.');
  // Many Lightning Address providers issue whole-sat invoices only.
  const msats = Math.round((cents / 100 / usdPerBtc) * 100_000_000) * 1000;
  if (!Number.isSafeInteger(msats) || msats < 1000) throw new Error('The amount is below one satoshi at the current rate.');
  return msats;
}

export function validateLnurlMetadata(data, msats) {
  if (!data || data.tag !== 'payRequest' || data.status === 'ERROR') throw new Error('This address is not an LNURL-pay recipient.');
  const callback = new URL(data.callback);
  if (callback.protocol !== 'https:') throw new Error('The Lightning callback must use HTTPS.');
  if (!Number.isSafeInteger(data.minSendable) || !Number.isSafeInteger(data.maxSendable) || msats < data.minSendable || msats > data.maxSendable) {
    throw new Error('The amount is outside this recipient’s Lightning limits.');
  }
  return callback;
}

export function invoiceMillisats(invoice) {
  const match = /^lnbc(\d+)([munp]?)1/i.exec(invoice);
  if (!match) throw new Error('The invoice has no recognizable mainnet amount.');
  const multiplier = { '': 100_000_000_000n, m: 100_000_000n, u: 100_000n, n: 100n, p: 1n }[match[2].toLowerCase()];
  const amount = BigInt(match[1]) * multiplier;
  if (match[2].toLowerCase() === 'p' && amount % 10n !== 0n) throw new Error('The invoice amount is less than a millisatoshi.');
  return Number(match[2].toLowerCase() === 'p' ? amount / 10n : amount);
}

export function validateInvoice(response, expectedMsats) {
  const invoice = response?.pr;
  if (response?.status === 'ERROR' || typeof invoice !== 'string' || !/^lnbc[0-9a-z]{50,}$/i.test(invoice)) {
    throw new Error('The recipient did not return a valid-looking mainnet Lightning invoice.');
  }
  if (invoiceMillisats(invoice) !== expectedMsats) throw new Error('The invoice amount does not match the requested tip.');
  return invoice.toLowerCase();
}

export async function fetchRate(fetcher = fetch) {
  const response = await fetcher('https://api.coinbase.com/v2/prices/BTC-USD/spot', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not retrieve a live BTC/USD exchange rate.');
  const data = await response.json();
  const rate = Number(data?.data?.amount);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('The BTC/USD exchange rate is unavailable.');
  return rate;
}

export async function requestInvoice(address, msats, fetcher = fetch) {
  const metaResponse = await fetcher(address.url, { cache: 'no-store' });
  if (!metaResponse.ok) throw new Error('Lightning address lookup failed.');
  const callback = validateLnurlMetadata(await metaResponse.json(), msats);
  callback.searchParams.set('amount', String(msats));
  const invoiceResponse = await fetcher(callback.toString(), { cache: 'no-store' });
  if (!invoiceResponse.ok) throw new Error('Lightning invoice request failed.');
  return validateInvoice(await invoiceResponse.json(), msats);
}
