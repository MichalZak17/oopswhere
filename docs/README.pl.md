<p align="center">
  <img src="banner.pl.svg" alt="Która sala? Już wiesz." width="720">
</p>

# oopswhere

**Która sala? Już wiesz.** Plan zajęć dla studentów uczelni korzystających z
[USOS](https://usos.edu.pl), na początek ZUT. Pokazuje plan zajęć.

[English →](../README.md)

## Co umie

- Pokazuje, gdzie jest sala.
- Pokazuje, kiedy.
- Dwa zajęcia naraz? Stoją obok siebie, jak na kartce.
- Działa na telefonie. Tak, na tym. Studenci zaoczni dostają szeroką sobotę i niedzielę zamiast pięciu
  pustych kolumn.
- Loguje raz, przez stronę logowania uczelni. Hasło zostaje tam. oopswhere nigdy go nie widzi.
- Pamięta, że logowanie już było. Zapamiętuje tylko listę Twoich grup, w zaszyfrowanym ciasteczku na
  Twoim urządzeniu. Bazy danych nie ma.
- Ładuje cały semestr razem ze stroną, więc zmiana tygodnia nie potrzebuje sieci. Plan zajęć okazuje
  się nie być aż tak dużą ilością danych.
- Polski i angielski, jasny i ciemny motyw, klawiatura i czytniki ekranu. Nie ma za co.

## Pytania

**Czy to oficjalna strona uczelni?** Nie. Oficjalność ma swoje zalety. Zostawiamy je uczelni.

**Co, jeśli USOS będzie miał gorszy dzień?** Pokażemy ostatni pobrany plan i powiemy o tym cicho.
Każdy ma gorsze dni.

**Czy mnie wylogujecie?** Jeśli tego zechcesz. Jest do tego przycisk.

**Coś nie gra.** Napisz w [issues](https://github.com/MichalZak17/oopswhere/issues). Odpowiemy.

## Jak to działa

Plany grup zajęciowych, sale i nazwiska prowadzących są w USOS publiczne. Twoje konto jest potrzebne
tylko do pobrania _listy Twoich grup_, raz na semestr. Po zalogowaniu dostęp jest od razu unieważniany,
a lista grup trafia do zaszyfrowanego ciasteczka w Twojej przeglądarce.

## Uruchomienie lokalnie

```bash
npm install
cp .env.example .env.local   # uzupełnij
npm run dev                  # http://localhost:4321
```

`/demo` (tylko na serwerze deweloperskim) działa bez kluczy. Aby włączyć logowanie, zarejestruj darmowy klucz na
<https://usosapi.zut.edu.pl/developers/> i ustaw `SESSION_SECRET` (`npm run secret`), `SITE_URL`,
`USOS_ZUT_CONSUMER_KEY` i `USOS_ZUT_CONSUMER_SECRET`.

## Wdrożenie

oopswhere jest hostowany samodzielnie: jeden obraz Dockera, jeden proces Node, bez bazy danych.
Instancja produkcyjna działa na [Coolify](https://coolify.io) za Cloudflare.

- **Coolify** — repozytorium Git, gałąź `master`, build pack **Dockerfile**, port `4321`. Ustaw
  powyższe zmienne tylko w runtime (odznacz _Available at Buildtime_). `SITE_URL` to publiczny adres
  dokładnie taki, jaki wpisują odwiedzający (np. `https://oopswhere.com`): za proxy aplikacja widzi
  tylko `http://`, więc to on decyduje o callbacku OAuth, ciasteczkach `Secure`, HSTS, sprawdzaniu
  Origin i kanonicznej domenie (inne hosty, np. `www.`, dostają przekierowanie 308). Health check:
  `/api/health`. W Cloudflare włącz **Always Use HTTPS**.
- **Dowolny host z Dockerem** — `docker compose up --build` (port 4321, health check `/api/health`),
  za dowolnym reverse proxy z TLS.

Szczegóły w [README](../README.md#deploy).

## Ograniczenia

Egzaminów i jednorazowych wydarzeń nie ma w tych danych. Odwołane zajęcia po prostu znikają, co też
jest sposobem na poinformowanie. W obu sprawach USOSweb pozostaje źródłem prawdy.

## Licencja

[MIT](LICENSE). Projekt niezależny, niezwiązany z ZUT ani twórcami USOS.

Nie musisz dziękować.
