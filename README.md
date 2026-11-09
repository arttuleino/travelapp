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

## Vaihe 2: chat, tiedotteet ja push-ilmoitukset

- Jokaisella varauksella on oma yksityinen keskustelu matkan oppaiden kanssa (Opas-välilehti). Oppaan tiedotteet koko ryhmälle näkyvät samassa näkymässä.
- Oppaan Viestit-välilehti listaa varaukset, lukemattomat ensin, ja sieltä lähetetään tiedote koko ryhmälle.
- Lukemattomien määrä näkyy välilehden merkissä. Luetuksi merkitseminen käyttää palvelimen kelloa.
- Lähettäjän nimi ja rooli tulevat tietokannasta lähettäjän omasta jäsenyydestä, joten kukaan ei voi kirjoittaa toisen nimissä. Viestejä ei voi muokata eikä poistaa.
- Push-ilmoitus lähtee uudesta viestistä ja tiedotteesta (`supabase/functions/push`). Ilmoitusta napauttamalla aukeaa oikea keskustelu.

### Push-ilmoitusten käyttöönotto

Push-ilmoitukset toimivat vain oikeassa puhelimessa (ei selaimessa eikä simulaattorissa), ja ne vaativat kehitysversion tai EAS-käännöksen, koska Expo Go ei tue niitä.

1. Luo EAS-projekti: `cd app && npx eas-cli@latest init`. Komento lisää `extra.eas.projectId`:n tiedostoon `app.json`.
2. Ota funktio käyttöön ja aseta salaisuus:
   ```bash
   npx supabase functions deploy push
   npx supabase secrets set PUSH_WEBHOOK_SECRET=<pitkä satunnainen merkkijono>
   ```
3. Luo Supabasen hallintapaneelissa kaksi **Database Webhookia** (Database → Webhooks): taulut `messages` ja `announcements`, tapahtuma *Insert*, tyyppi *Supabase Edge Functions*, funktio `push`, HTTP-otsake `x-webhook-secret: <sama salaisuus>`.
4. Käännä sovellus puhelimeen: `npx eas-cli@latest build --profile development`.

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

## Ajastetut ja muokatut tiedotteet

Opas voi ajastaa tiedotteen (Viestit → Lähetä tiedote → Ajasta) ja muokata tai perua sen Viestit-sivun Tiedotteet-listasta. Matkustajat näkevät ajastetun tiedotteen vasta lähetysaikana; tämän hoitaa tietokannan käyttöoikeus (`send_at`), joten se toimii ilman ajastettua taustatyötä. Lähetetyn tiedotteen muokkaus näkyy merkinnällä "muokattu", eikä siitä lähetetä uutta push-ilmoitusta.

Push-ilmoitus ajastetusta tiedotteesta lähtee, kun push-funktiota kutsutaan minuutin välein. Kun push on otettu käyttöön, aja SQL Editorissa (laajennukset pg_cron ja pg_net päälle kohdasta Database → Extensions; korvaa PROJEKTI ja SALAISUUS):

```sql
select cron.schedule('push-due-announcements', '* * * * *', $$
  select net.http_post(
    url := 'https://PROJEKTI.supabase.co/functions/v1/push',
    headers := '{"content-type": "application/json", "x-webhook-secret": "SALAISUUS"}'::jsonb,
    body := '{"due": true}'::jsonb
  )
$$);
```

## Testitunnukset ilman sähköpostia

Kun `EXPO_PUBLIC_PASSWORD_LOGIN=1`, kirjautumissivulla näkyy "Testitunnus: kirjaudu salasanalla". Luo tunnukset Supabasessa: Authentication → Users → Add user → Create new user, käytä samaa sähköpostia kuin `trip_members`-taulussa ja valitse Auto Confirm User. Oikeassa käytössä asetus pidetään pois päältä, ja kirjautuminen tapahtuu sähköpostikoodilla.

## Matkan tuonti

Ennen varausjärjestelmän rajapintaa matkat tuodaan kolmesta CSV-tiedostosta (pilkku tai puolipiste, päivämäärät muodossa 15.2.2027 tai 2027-02-15). Mallit ovat kansiossa `app/scripts/example-trip/`.

```bash
cd app
npm run import-trip -- --operator demo --dir scripts/example-trip --dry-run   # vain tarkistus
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import-trip -- --operator demo --dir scripts/example-trip
```

Tuonti kertoo virheet rivinumeroineen. Uudelleentuonti päivittää matkan ja henkilöt, mutta ei koske ohjelmaan, jota opas on jo muokannut (ellei anneta `--replace-programme`). Palveluavainta (`service_role`) ei koskaan laiteta sovellukseen.

## Bussipysäkit ja aikataulut

Kohteen bussipysäkit ja niiden aikataulun mukaiset lähdöt tuodaan avoimesta GTFS-aikataulusta. Itävallan aikataulut löytyvät osoitteesta [data.mobilitaetsverbuende.at](https://data.mobilitaetsverbuende.at). Palvelu on ilmainen, mutta vaatii rekisteröitymisen.

```bash
cd app
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-transit.mjs \
  --trip <matkan uuid> --gtfs ~/Downloads/gtfs.zip --lat 47.3913 --lon 12.6364 --radius 6000 \
  --source "Mobilitätsverbünde Österreich"
```

- **Mitä tuodaan:** pysäkit annetun säteen sisältä sekä niiden lähdöt matkan päiville. Uusi ajo korvaa matkan aiemmat pysäkit.
- **Jos aikataulu ei kata matkaa:** matkan päivät täytetään aikataulun viimeisen viikon samalta viikonpäivältä. Näin käy esimerkiksi silloin, kun ensi kauden aikataulua ei ole vielä julkaistu. Sovellus kertoo tästä.
- **Ajat ovat aikataulun mukaisia, eivät reaaliaikaisia,** ja sovellus näyttää ne sellaisina. Salzburgin busseille ei ole avointa reaaliaikadataa. Sarake `transit_departures.delay_s` on valmiina live-viiveelle.
- **Missä näkyy:** Nyt-sivulle tulee kortti "Bussipysäkit ja lähdöt", kun matkalle on tuotu pysäkkejä. Kartta näkyy puhelimessa; selaimessa näkyy vain pysäkkilista.

## Tarkistukset

```bash
cd app
npm test            # aikalogiikka, lukemattomat viestit, CSV-tuonti ja push-funktion apufunktiot
npm run typecheck
npx expo lint
```

## Seuraavat vaiheet

3. Kartta, oppaan live-sijainti ja vastauspankki
4. Matkakassa ja viikkoraportti
5. Lisäpalveluiden varaus ja maksut matkanjärjestäjän järjestelmien kautta
