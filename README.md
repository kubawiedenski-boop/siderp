# SideRP — localhost + Discord

1. Zainstaluj **Node.js LTS**.
2. Kliknij dwa razy `START.bat`.
3. Przy pierwszym uruchomieniu otworzy się `.env`. Wpisz `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` i `COOKIE_SECRET`.
4. Uruchom `START.bat` ponownie. Strona otworzy się automatycznie pod `http://localhost:37033`.

W Discord Developer Portal → OAuth2 → Redirects dodaj:
`http://localhost:37033/auth/callback`

Scope: `identify`.

Client Secret zostaje tylko w `.env`. Podania zapisują się w `data/applications.json`.


## Panel opiekunów

- Administrator (`ADMIN_ROLE_ID`) widzi wszystkie podania.
- Każda rola `ROLE_*_ID` daje dostęp tylko do odpowiadającej frakcji.
- `ROLE_CRIME_ID` = tylko „Organizacja Przestępcza”.
- `ROLE_LSPD_ID`, `ROLE_LSSD_ID` itd. można ustawić na osobne role Discord.
- Po zmianie `.env` uruchom ponownie `START.bat`.

## Ważne

Nie wpisuj Client Secret ani Bot Token do HTML. Trzymaj je wyłącznie w `.env`. Jeśli sekret/token został wcześniej ujawniony, zresetuj go w Discord Developer Portal.


## Sklep — zamówienia ręczne
Klient tworzy zamówienie z numerem `SR-XXXXXX`, następnie podaje numer na Discordzie w Tickecie Zakupowym. Administrator w Panelu Opiekuna → Zamówienia potwierdza płatność i oznacza zakup jako zrealizowany.
