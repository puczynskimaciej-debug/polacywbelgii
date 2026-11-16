---
layout: legal.njk
title: Politique des cookies
description: Politique des cookies PolacywBelgii.eu.
pageKey: legal
legalKey: legal.cookies
permalink: /fr/polityka-cookies/index.html
---

## Stockage dans le navigateur

Lors de la première visite du site public, nous ne déposons ni cookies ni données dans localStorage. Nous n'utilisons ni outils d'analyse, ni pixels publicitaires, ni polices chargées depuis un service externe. Aucun bandeau de consentement n'est affiché car cette version n'active pas de suivi facultatif.

| Mécanisme | Quand et pourquoi | Durée et accès |
| --- | --- | --- |
| `siteLanguage` (sessionStorage) | Après le choix d'une langue, pour la conserver pendant la navigation. | Jusqu'à la fermeture de l'onglet ; scripts du site seulement. |
| `pbe-order-{id}` (sessionStorage) | Après une commande, pour retrouver son statut après le paiement. | Jusqu'à la fermeture de l'onglet ; scripts du site seulement. |
| `__Host-pbe_session` (cookie) | Après la connexion d'un administrateur, pour l'authentification du CMS ; HttpOnly, Secure, SameSite=Strict. | Huit heures au maximum ; envoyé au serveur du site. |
| `ai-chat-conversation` (sessionStorage) | Après l'utilisation du chat IA par un administrateur, pour identifier la conversation. | Jusqu'à la fermeture de l'onglet ; scripts du CMS seulement. |

Ces mécanismes servent aux fonctions demandées de langue, de commande et d'administration sécurisée. Ils ne servent ni au profilage ni à la publicité comportementale. Vous pouvez effacer les données du site dans votre navigateur ; la déconnexion termine la session CMS.

Si les paiements sont activés, l'utilisateur poursuit volontairement vers Stripe, qui peut employer ses propres technologies sur son site. Toute analyse, publicité ou autre stockage facultatif futur impose une révision de cette politique et du consentement avant activation. Cloudflare peut appliquer conditionnellement des mesures de sécurité selon la configuration ; elles doivent être revérifiées après toute modification.

Questions : kontakt@polacywbelgii.eu. [Politique de confidentialité](/fr/polityka-prywatnosci/).
