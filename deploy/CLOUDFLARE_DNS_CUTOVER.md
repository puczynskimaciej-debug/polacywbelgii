# polacywbelgii.eu: DNS cutover notes (2026-10-21)

Source: user's OVH export `polacywbelgii.eu_dns_zone.txt`. Review against the live OVH zone again before changing nameservers. This file contains no credentials.

## Current state

- `www` CNAME now points to `polacywbelgii.pages.dev` at OVH; Pages serves HTTPS 200. Some recursive resolvers may retain the former Netlify target for its 3600-second TTL.
- Apex `A 75.2.60.5` still points to suspended Netlify and serves 503.
- Registrar DS key tag 61640 (algorithm 8) was still publicly visible after the user requested DNSSEC deactivation. Do not switch nameservers while this DS can be cached.
- OVH authoritative nameservers: `dns200.anycast.me`, `ns200.anycast.me`.

## Records to retain in Cloudflare DNS

| Type | Name | Value | Priority / settings |
| --- | --- | --- | --- |
| MX | @ | mx1.mail.ovh.net | 1 |
| MX | @ | mx2.mail.ovh.net | 5 |
| MX | @ | mx3.mail.ovh.net | 100 |
| TXT | @ | `v=spf1 include:mx.ovh.com -all` | SPF |
| SRV | _autodiscover._tcp | mailconfig.ovh.net | priority 0, weight 0, port 443 |
| SRV | _imaps._tcp | ssl0.ovh.net | priority 0, weight 0, port 993 |
| SRV | _submission._tcp | ssl0.ovh.net | priority 0, weight 0, port 465 |
| CNAME | autoconfig | mailconfig.ovh.net | DNS only |
| CNAME | autodiscover | mailconfig.ovh.net | DNS only |
| CNAME | imap | ssl0.ovh.net | DNS only |
| CNAME | mail | ssl0.ovh.net | DNS only |
| CNAME | pop3 | ssl0.ovh.net | DNS only |
| CNAME | smtp | ssl0.ovh.net | DNS only |
| CNAME | ovhmo-selector-1._domainkey | ovhmo-selector-1._domainkey.4773296.gl.dkim.mail.ovh.net | DNS only |
| CNAME | ovhmo-selector-2._domainkey | ovhmo-selector-2._domainkey.4773297.gl.dkim.mail.ovh.net | DNS only |
| CNAME | ftp | polacywbelgii.eu | DNS only; inherited from OVH export, verify whether used |

## Web records at cutover

Pages already serves `www.polacywbelgii.eu`. Pages will not attach the apex until the Cloudflare zone is active. Therefore configure a Cloudflare Single Redirect from the apex to `https://www.polacywbelgii.eu`, preserving path and query, before changing nameservers. Replace the *pending Cloudflare zone's* imported `A @ 75.2.60.5` with a proxied placeholder `A @ 192.0.2.1`, which lets the redirect run without Netlify as origin. Keep `CNAME www polacywbelgii.pages.dev` proxied. Do not remove the corresponding OVH records until the delegation has changed. Do not import the OVH SOA/NS records; Cloudflare assigns its own. The OVH-specific TXT `1|www.polacywbelgii.eu` is a redirect marker and is not needed on Cloudflare.

## Sequence

1. Wait for OVH DNSSEC deactivation and disappearance of the previous DS from public validating resolvers, including cached TTL.
2. Create Cloudflare Free zone. Compare every record above to the zone's automatic scan; add missing records and set all mail CNAMEs to DNS only.
3. Configure the apex redirect and placeholder proxied A record. Verify Cloudflare's assigned nameservers and all records before changing OVH delegation.
4. Change nameservers at OVH; verify apex/www HTTPS and mail records externally. Re-enable DNSSEC using Cloudflare's new DS only after the new delegation is stable.
