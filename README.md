# Tip Your Customer

A static, mobile-friendly tip QR generator designed for GitHub Pages. The business enters a USD amount, chooses Cash App or Bitcoin Lightning, and enters the recipient customer’s $cashtag or Lightning Address. Payment is completed in the sender’s own app or wallet; this site does not collect funds or credentials.

## Run locally

Requires Node.js 20+.

```
npm ci
npm test
npm run build
python -m http.server 8765 --directory docs
```

Open http://localhost:8765/. The `docs/` directory is the GitHub Pages artifact and is checked into the repository.

## GitHub Pages

Publish the `main` branch from the `/docs` directory in Repository Settings → Pages. The expected URL for repository `OWNER/tip-your-customer` is `https://OWNER.github.io/tip-your-customer/`. All assets use relative paths for project-site hosting. Re-run `npm run build` after source changes, then commit `docs/`.

## Payment behavior & limitations

- Cash App: QR encodes the official `https://cash.app/$cashtag` recipient profile URL. The publicly documented link does **not guarantee amount prefill**; the payer must enter the displayed USD amount and confirm the recipient in Cash App.
- Lightning: the site obtains a live BTC/USD spot price from Coinbase, converts the USD amount to whole satoshis, and tries the recipient’s Lightning Address LNURL-pay metadata and callback from the browser. If CORS permits, it displays the returned BOLT11 invoice QR and verifies the amount encoded in the invoice prefix. The payer must still verify the recipient and amount in their wallet. This application does not verify payment settlement or the invoice’s cryptographic signature.
- If the recipient server blocks cross-origin browser requests, rejects the amount, or the rate API is unavailable, it displays an LNURL-pay QR instead. A compatible wallet obtains an invoice upon scanning; the wallet user must manually enter/verify the intended amount. The fallback QR does **not** lock in a USD price or preset a Lightning amount.
- GitHub Pages has no server-side runtime. No LndHub secret or wallet credentials are included. LNURL-pay is the credential-free invoice-generation protocol used here; broad support for non-CORS Lightning Address servers would require a trusted server-side proxy at a separate host.
- Exchange rates and invoices are momentary; generate a fresh QR if it expires. Sending is not automatic. Verify recipient details independently before paying.

## Deployment status

Publishing to `mrpliberty/tip-your-customer` was authorized, but the available GitHub personal access token cannot create repositories (GitHub returns HTTP 403). The repository and Pages URL have not yet been created. Deployment requires a credential for `mrpliberty` with repository creation, Contents write, and Pages administration permissions, or an existing repository with those permissions granted. Once access is available, publish `main` and enable Pages from `/docs` as described above.
