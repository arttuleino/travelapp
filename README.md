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

## Paikallisliikenne

Sovellus ei näytä bussiaikatauluja itse. Nyt-sivun Paikallisliikenne-kortti suosittelee kohteen oman alueen joukkoliikennesovellusta (esim. Salzburg Verkehr, VVT SmartRide, südtirolmobil) ja linkittää skibussin aikatauluihin. Kohteet ja sovellukset ovat tiedostossa `app/src/lib/local-transport.ts`, ja kohde tunnistetaan matkan `destination`-kentästä. Lista tarkistettiin marraskuussa 2026, ja se kannattaa tarkistaa kausittain.

## AI-opas

Matkustajan Opas-välilehdellä on kaksi näkymää: chat oppaan kanssa ja **AI-opas**. AI-opas vastaa matkan omista tiedoista: ohjelmasta, hotellista, lennoista, oppaan tiedotteista ja oppaan **vastauspankista** (Profiili → Vastauspankki, vain oppaille). Jos tieto puuttuu tai kysymys koskee varausmuutosta, rahaa, terveyttä tai turvallisuutta, vastauksessa on nappi "Lähetä kysymys oppaalle", joka lähettää kysymyksen tavallisena viestinä oppaan chattiin (ja push-ilmoituksena).

- Claude-kutsu tehdään Edge Functionissa `supabase/functions/ai-guide`. API-avain on vain Supabasen salaisuuksissa, ei koskaan sovelluksessa.
- Funktio lukee matkan tiedot **kysyjän omilla oikeuksilla** (RLS), joten AI näkee vain sen, minkä matkustaja itsekin näkee sovelluksessa.
- Keskustelu AI-oppaan kanssa säilyy vain puhelimessa sovelluksen ollessa auki; sitä ei tallenneta tietokantaan.
- Oletusmalli on `claude-opus-5-5` (pieni ajattelutaso, vastaus rakenteisena JSONina, matkan tiedot välimuistissa). Halvempaan malliin vaihdetaan salaisuudella `AI_GUIDE_MODEL`, esim. `claude-haiku-5-5`.

Käyttöönotto:

```bash
# 1. Vastauspankin taulu: aja SQL-editorissa supabase/migrations/20261116090000_answer_bank.sql
# 2. Claude API -avain (console.anthropic.com) ja funktio
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy ai-guide
```

Demotilassa (`EXPO_PUBLIC_DEMO_MODE=1`) sovellus kutsuu demopalvelimen osoitetta `/demo-api/ai-guide` samalla rajapinnalla (`{trip_id, question, history, locale, now_local}` → `{answer, handoff, handoff_reason, sources}`). Jos palvelimella ei ole sitä, AI-opas kertoo, ettei se ole käytössä, ja tarjoaa kysymyksen lähettämistä oppaalle.

## Tarkistukset

```bash
cd app
npm test            # aikalogiikka, lukemattomat viestit, CSV-tuonti, push- ja AI-opas-funktioiden apufunktiot
npm run typecheck
npx expo lint
```

## Seuraavat vaiheet

3. Oppaan live-sijainti ja AI-työkalut oppaalle (vastausluonnokset, käännökset, ehdotukset)
4. Matkakassa ja viikkoraportti
5. Lisäpalveluiden varaus ja maksut matkanjärjestäjän järjestelmien kautta
