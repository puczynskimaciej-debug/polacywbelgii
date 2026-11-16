---
layout: legal.njk
title: Cookie policy
description: Cookie policy PolacywBelgii.eu.
pageKey: legal
legalKey: legal.cookies
permalink: /en/polityka-cookies/index.html
---

## Browser storage

On the public site, the first visit does not set cookies or localStorage. We do not run analytics, advertising pixels or externally hosted fonts. There is no consent banner because the current version does not activate optional tracking.

| Mechanism | When and why | Duration and access |
| --- | --- | --- |
| `siteLanguage` (sessionStorage) | After choosing a language, to retain that choice while browsing. | Until the tab closes; site scripts only. |
| `pbe-order-{id}` (sessionStorage) | After placing an order, to return to its status after payment. | Until the tab closes; site scripts only. |
| `__Host-pbe_session` (cookie) | After administrator login, to authenticate the CMS; HttpOnly, Secure, SameSite=Strict. | At most 8 hours; sent to this site's server. |
| `ai-chat-conversation` (sessionStorage) | After an administrator uses AI chat, to identify the current conversation. | Until the tab closes; CMS scripts only. |

These mechanisms support the requested language, order and secure administration functions. They are not used for profiling or behavioural advertising. You can clear site data in your browser; logging out ends the CMS session.

If payments are enabled, the user actively continues to Stripe, which may use its own technologies on its site. Any future analytics, marketing or other optional storage requires a policy and consent review before activation. Cloudflare may conditionally use security measures depending on configuration; these should be checked again if settings change.

Questions: kontakt@polacywbelgii.eu. [Privacy policy](/en/polityka-prywatnosci/).
