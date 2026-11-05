# Minun matkani – matkustajan ja oppaan sovellus

Sovellus matkanjärjestäjän asiakkaille matkan ajaksi: live-aikajana matkan ohjelmasta, oppaan tiedotteet ja myöhemmin chat, kartta, vastauspankki ja matkakassa. Kaikki matkan tiedot tulevat matkanjärjestäjän varausjärjestelmästä.

Klikattava konseptiprototyyppi: https://claude.ai/artifact/8mRvs8VKKpotqsYxmcScmc

## Rakenne

| Kansio | Sisältö |
| --- | --- |
| `app/` | Expo (React Native) -sovellus: iOS, Android ja selain samasta koodista. Reitit ovat kansiossa `app/src/app/`. |
| `supabase/` | Tietokannan rakenne (`migrations/`), esimerkkidata (`seed.sql`) ja kirjautumiskoodin sähköpostipohja. |
| `app/scripts/` | Matkan tuonti CSV-tiedostoista (`import-trip.mjs`) ja esimerkkitiedostot. |

## Vaihe 1 (tämä versio)

- Kirjautuminen sähköpostiin lähetettävällä 6-numeroisella koodilla. Matkustaja kirjautuu samalla osoitteella, jonka antoi varatessaan; erillistä rekisteröitymistä ei ole.
- Nyt-näkymä: matkan päivä, oppaan viimeisin tiedote ja päivän aikajana, jossa näkyy käynnissä oleva ja seuraava ohjelmakohta. Aika lasketaan kohteen aikavyöhykkeessä.
- Viikko-ohjelma päivittäin.
- Oppaan ohjelmaeditori: lisää, muokkaa ja poista ohjelmakohtia. Siirretyssä kohdassa näkyy "Siirtynyt 09:00 → 09:15", ja opas voi samalla lähettää ryhmälle tiedotteen.
- Muutokset näkyvät matkustajille heti (Supabase Realtime).
- Käyttöoikeudet tarkistetaan tietokannassa (row level security): matkustaja näkee vain oman matkansa ja oman varauksensa, vain opas voi muuttaa ohjelmaa.

## Käynnistys paikallisesti

Tarvitset Node.js 22:n ja Dockerin (paikallista Supabasea varten).

```bash
# 1. Tietokanta ja kirjautuminen (luo taulut ja esimerkkimatkan)
npx supabase start
npx supabase status          # näyttää API URL:n ja anon-avaimen

# 2. Sovellus
cd app
cp .env.example .env         # täytä URL ja anon-avain
npm install
npx expo start               # avaa selaimessa painamalla w, puhelimessa Expo Go -sovelluksella
```

Kirjaudu esimerkkimatkalle osoitteella `traveller@example.com` (matkustaja) tai `guide@example.com` (opas). Kirjautumiskoodi tulee paikalliseen postilaatikkoon osoitteessa http://127.0.0.1:54324. Esimerkkimatka on helmikuussa 2027, joten `.env.example` asettaa sovelluksen kellon matkan kolmanteen päivään (`EXPO_PUBLIC_DEMO_NOW`). Poista rivi, kun käytät oikeita matkoja.

## Matkan tuonti

Ennen varausjärjestelmän rajapintaa matkat tuodaan kolmesta CSV-tiedostosta (pilkku tai puolipiste, päivämäärät muodossa 15.2.2027 tai 2027-02-15). Mallit ovat kansiossa `app/scripts/example-trip/`.

```bash
cd app
npm run import-trip -- --operator demo --dir scripts/example-trip --dry-run   # vain tarkistus
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import-trip -- --operator demo --dir scripts/example-trip
```

Tuonti kertoo virheet rivinumeroineen. Uudelleentuonti päivittää matkan ja henkilöt, mutta ei koske ohjelmaan, jota opas on jo muokannut (ellei anneta `--replace-programme`). Palveluavainta (`service_role`) ei koskaan laiteta sovellukseen.

## Tarkistukset

```bash
cd app
npm test            # aikalogiikka ja CSV-tuonti
npm run typecheck
npx expo lint
```

## Seuraavat vaiheet

2. Chat oppaan kanssa, ryhmätiedotteet ja push-ilmoitukset
3. Kartta, oppaan live-sijainti ja vastauspankki
4. Matkakassa ja viikkoraportti
5. Lisäpalveluiden varaus ja maksut matkanjärjestäjän järjestelmien kautta
