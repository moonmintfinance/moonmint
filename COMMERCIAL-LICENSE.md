# Moon Mint Finance - Commercial License Agreement

**IMPORTANT**: By downloading, installing, or operating Moon Mint in a production environment, you agree to be bound by these terms. If you do not agree, you must use only the non-production features under the Business Source License.

---

## Terms

"Production Environment" shall mean any environment where the Software is accessible to end-users, handles real value (cryptocurrency or tokens) on a mainnet blockchain, or is used for any business purpose other than internal development and testing.

A "deployment" shall mean one production environment accessible to end-users, 
regardless of:
- Number of servers/containers behind a load balancer
- Geographic regions (if serving the same user base)
- CDN/caching layers

### Pricing
- **Upfront**: $150 USD worth of Solana at the time of payment determined by Coinbase spot price (one-time, non-refundable)
- **Ongoing**: 10% of gross fees collected from your deployment
- **Payment Schedule**: 
  - Upfront payment due before license activation
  - Revenue share due within 24 hours of end of each day (UTC)
  - Calculate total fees collected during that day
  - Send 10% in a single daily payment to the
    wallet address Moon Mint provides you with on receipt of your licence
  - Minimum daily payment: 0.01 SOL (smaller amounts accumulate)

**Verification:**
- You agree to provide wallet addresses used to collect fees
- Moon Mint may request on-chain verification via blockchain explorer
- Discrepancies may trigger an audit 

**If You Collect $0 in Fees:**
- No payment is due
- License remains active

## Late Payment & Non-Compliance

**Late Payments:**
- Payments overdue by 5+ days: Email reminder sent
- Payments overdue by 14+ days: License suspended until receipt of payment
- Payments overdue by 30+ days: License revoked

**License Suspension:**
- You must cease production use immediately
- Outstanding amounts remain due 
- License may be reinstated upon full payment + $100 USD reinstatement fee payable in SOL at Coinbase spot price at time of payment

**Material Breach:**
- Willful non-reporting or fraudulent reporting
- Continued production use after suspension
- Results in immediate termination + potential legal action

### What's Included
- Production use of Moon Mint token minter repository
- 12-month license period from purchase date
- Right to install on one production deployment

### Restrictions
To obtain a commercial license, you agree:

1. **No Brand Confusion**
   - You will not use "Moon Mint" in your domain name or branding
   - You will not imply affiliation with Moon Mint Finance

2. **Single Deployment**
   - License covers ONE production deployment
   - Each legally distinct entity serving different user bases requires a 
     separate license.
   - Multiple environments (staging, testing) do not require licenses

3. **No Resale or Sublicensing**
   - You cannot resell, redistribute, or sublicense Moon Mint
   - End-users of your service do not need individual licenses
   - You retain all rights to your derivative works

---

## No Refunds Policy

- **Upfront Payment**: Non-refundable once license is activated
- **Revenue Share Payments**: Non-refundable once made
- **Early Termination**: If you cease operations, only revenue share 
  for fees collected before termination is due

By purchasing a commercial license, you acknowledge and accept this no-refund policy.

---

## After 2029-01-01 (MIT Conversion)

On January 1, 2029, this repository automatically converts to MIT license.

**Impact on Active Licenses:**
- All commercial license obligations immediately cease
- No payments due for any period after 2029-01-01
- All users may use Moon Mint freely under MIT terms
---

## Compliance & Enforcement

By accepting this commercial license, you represent and warrant that:

- You are using Moon Mint only in the production deployment(s) specified at purchase
- You will not use Moon Mint in any production environment without this agreement
- You will not circumvent license restrictions through shell companies, resale, or other means
- All information provided at purchase (deployment URL, use case) is accurate and current

Moon Mint Finance reserves the right to:
- Request:
  - Deployment URL(s) currently using the software
  - Approximate monthly active users or transaction volume
  - Confirmation of license key installation
- We will NOT request:
  - Access to your databases or user data
  - Source code of your derivative works
  - Financial records beyond license payment confirmation
- Conduct audits:
  - Audits limited to once per year unless breach is suspected.
- Terminate this license immediately with no refund if violations are discovered

---

## Intellectual Property

- You retain all rights to your derivative works and modifications
- Moon Mint Finance retains all rights to Moon Mint and its trademarks and the source code of this repository
- You may not claim ownership or authorship of Moon Mint

---

## Disclaimer of Warranties

Moon Mint is provided "AS-IS" without warranties of any kind, express or implied, including:
- Fitness for a particular purpose
- Merchantability
- Non-infringement
- Uninterrupted operation

Moon Mint Finance is not liable for any damages, including data loss, business interruption, or lost profits arising from use of the Moon Mint token minter.

---

## Limitation of Liability

Except for your payment obligations, Moon Mint Finance's total liability under this agreement shall not exceed the amount paid for this license. This limitation applies to all causes of action and theories of liability.

---

## Governing Law & Disputes

**Dispute Resolution:**
- All disputes shall be resolved first through good faith negotiation
- If good faith negotiation fails all disputes shall be resolved through binding arbitration
- Arbitration conducted under the Canadian Arbitration Association (ADR Institute of Canada) rules
- Arbitration location: Virtual/online (or neutral Canadian city of arbitrator's choosing)
- Governing law: Federal laws of Canada and general principles of contract law
- Language: English

**Arbitration Process:**
- Single arbitrator mutually agreed upon by both parties
- If no agreement within 30 days, arbitrator appointed by ADR Institute of Canada
- Arbitration decision is final and binding
- Each party bears its own legal costs unless arbitrator determines otherwise
- Judgment on the arbitration award may be entered in any court having jurisdiction

---

## How to Purchase

Email: contact@moonmint.finance with:
- Your deployment URL
- Expected monthly token volume
- Primary use case
- Company name and contact information

After receiving your request, Moon Mint Finance will provide:
1. A formal Commercial License Agreement to sign
2. A wallet address to which Moon Mint will receive its 10% fee
3. A unique License Key

Upon activation, you will receive a unique license key that must be:
- Integrated as a comment into a publicly viewable html component of your production deployment
- The comment must use this exact format "//License key "your key", issued by Moon Mint Finance, expiring "date"
- Maintained in an unmodified state

**License Key Compliance:**
- Tampering with, removing, or obscuring the license key constitutes material breach
- Each license key is unique and non-transferable
- Using another party's license key is a violation for both parties
- Moon Mint Finance may verify license keys via automated scanning
- Violations discovered via scanning will result in immediate suspension notice

**License Key Verification:**
- Moon Mint Finance may request proof of license key installation at any time
- Licensee must respond within 7 business days with URL showing visible key
- Failure to provide proof constitutes material breach
---

## Term & Renewal

- Initial term: 12 months from license activation date
- Renewal: Contact contact@moonmint.finance 30 days before expiration
- At renewal fees may be adjusted at Moon Mint Finance's discretion
- After 2029-01-01, no new commercial licenses will be issued

---

## Termination

This license terminates automatically upon:
- Expiration of the 12-month term (non-renewal)
- Any material breach of this agreement
- 2029-01-01 (for versions released after this date, which convert to MIT)

Upon termination:
- You must cease production use of Moon Mint
- Existing data remains yours to export or delete
- No refunds will be provided

---

## Force Majeure

Neither party shall be liable for failure to perform obligations due to events 
beyond reasonable control, including:
- Blockchain network failures or forks
- Government restrictions on cryptocurrency
- Exchange outages preventing SOL transactions


During force majeure:
- Affected party must notify other party within 48 hours
- Obligations are suspended (not eliminated)
- Both parties will work in good faith to find alternative solutions
- If force majeure exceeds 30 days, either party may terminate without penalty

---

## Severability

If any provision of this agreement is found to be unenforceable or invalid by 
an arbitrator or court, the remaining provisions will continue in full force 
and effect. The invalid provision will be replaced with a valid provision that 
most closely matches the intent of the original.

---

**Last Updated**: November 15, 2025
**Version**: 1.0