# Nörttien Arvauskeskus – moninpelattava tietokilpailu Netlifyyn

Nörttien Arvauskeskus on selainpohjainen tietovisa. Yhdessä huoneessa voi olla **enintään 10 pelaajaa** (pelin luoja mukaan lukien). Peli käynnistyy automaattisesti, kun kaikki huoneessa ovat valmiina.

## Ominaisuudet

- Pelin luonti ja **6-merkkinen liittymiskoodi**; kaverin voi kutsua linkillä.
- 5/10/15/20/30 kysymystä, **viisi vastausvaihtoehtoa** ja aina yksi oikea.
- Valittava vastausaika (10–60 sekuntia) ja kolme vaikeustasoa.
- Sama kysymys kaikille. Valintaa voi vaihtaa, kunnes kaikki ovat vastanneet tai vastausaika päättyy.
- Oikeasta lopullisesta valinnasta saa 600–1000 pistettä sen lähetysajan mukaan.
- Välitulokset, oikean vastauksen paljastus ja lopulliset sijoitukset.
- Puhelimilla toimiva responsiivinen käyttöliittymä, ei rekisteröitymistä.
- Kysymykset voidaan luoda Gemini API:lla **huoneen luontivaiheessa**, jotta kierrosten väliin ei tule tekoälyviivettä.
- Ilman Gemini-avainta käytettävissä on **50 valmista yleistietokysymystä**. Demotilassa valittu aihealue ja vaikeustaso eivät muuta kysymyksiä.

## Mitä tarvitaan?

1. [Supabase](https://supabase.com/) – pelien ja pelaajien yhteinen tietokanta.
2. [Netlify](https://www.netlify.com/) – selainkäyttöliittymän ja palvelinfunktioiden julkaisu.
3. Valinnainen [Google Gemini API](https://aistudio.google.com/) – uudet, vapaasti valittavien aiheiden kysymykset. **Geminin maksuttomalla API-tasolla on käyttörajoitukset.**

Pelkkä HTML:n pudottaminen Netlify Dropiin **ei riitä**, sillä peli vaatii palvelinfunktiot ja Supabase-tietokannan. Julkaise koko lähdekoodiprojekti GitHub-integraatiolla tai Netlify CLI:llä.

## Julkaisu vaihe vaiheelta

### 1. Luo Supabase-projekti

- Luo uusi projekti Supabasen hallintapaneelissa.
- Avaa **SQL Editor**, kopioi `supabase.sql`-tiedoston koko sisältö, paina **Run**.
- Siirry projektin **Settings → API Keys** -kohtaan ja luo/kopioi **secret key** (`sb_secret_...`). Älä valitse julkista `sb_publishable_...`-avainta.
- Kopioi myös **Project URL** (`https://xxxxx.supabase.co`) kohdasta projektin asetukset.

### 2. Vie projekti GitHubiin

- Pura ZIP-tiedosto.
- Luo uusi GitHub-repositorio ja vie sen juureen **kaikki** kansiot ja tiedostot tästä projektista. Projekti sisältää mm. `public`, `netlify/functions`, `supabase.sql` ja `netlify.toml`.
- **Älä koskaan lisää Supabase-secret- tai Gemini-avainta GitHubiin.** `.env.example` sisältää vain esimerkit, ei oikeita avaimia.

### 3. Luo Netlify-sivusto

- Netlifyssä valitse **Add new project → Import an existing project → GitHub**.
- Valitse repositorio. `netlify.toml` määrittelee automaattisesti julkaistavan `public`-kansion ja `netlify/functions`-hakemiston. Erillistä build-komentoa ei tarvita.
- Avaa **Project configuration → Environment variables** ja lisää:

  | Muuttuja | Arvo |
  |---|---|
  | `SUPABASE_URL` | `https://xxxxx.supabase.co` |
  | `SUPABASE_SECRET_KEY` | `sb_secret_...` — Supabasen yksityinen avain |
  | `GEMINI_API_KEY` | Valinnainen: `Google AI Studion API-avain` |
  | `GEMINI_MODEL` | Valinnainen, oletus `gemini-2.5-flash-lite` |

- Tee uusi deploy, kun ympäristömuuttujat on lisätty.
- Avaa Netlifyn antama `https://...netlify.app`-osoite.

**Vaihtoehto GitHubille:** Netlify CLI:llä voi julkaista koko projektin sen juurihakemistosta (`netlify login`, `netlify init`, `netlify deploy --build --prod`), mutta lisää ympäristömuuttujat ensin Netlifyssä.

### 4. Kokeile kahdella laitteella

- Avaa sama Netlify-sivusto kahdella puhelimella tai kahdessa eri selaimessa.
- Ensimmäinen luo pelin ja valitsee nimimerkin. Hän näkyy itse pelaajalistassa.
- Toinen syöttää annetun koodin ja oman nimimerkin.
- Molemmat painavat **Valmiina**. Peli alkaa, kun molemmat ovat valmiina. Kysymysten ja tulosten pitäisi päivittyä kummassakin laitteessa noin 1–2 sekunnin välein.

## Pelin toiminta ja rajoitukset

**Palvelintekniikka:** Netlify Function käsittelee pyynnöt `/api/create`, `/api/join`, `/api/ready`, `/api/answer` ja `/api/state`. Funktio käyttää Supabasen Data REST API:a ja tietokantafunktioita (RPC). Pelilogiikka, vastausten oikeellisuus ja pisteytys pysyvät palvelinpuolella. Selain ei saa oikeaa vastausta ennen kierroksen paljastusvaihetta. Selain pollaa tilaa 1,25 sekunnin välein; erillistä Supabase Realtime -yhteyttä ei tarvita.

**Istunnon palautus:** Pelaajatunniste tallennetaan kyseisen selaimen paikalliseen tallennustilaan, ja huoneen voi avata uudelleen samalla laitteella ja URL-osoitteella. Pelaajaa ei kuitenkaan voi tällä versiolla poistaa huoneesta; 10 paikan katto koskee myös yhteyden katkaisseita pelaajia.

**Tekoälyn laatu:** Generointi palauttaa rakenteisesti täsmälleen viisi vaihtoehtoa ja oikean vastauksen indeksin; koodi validoi muodon. Tämä **ei takaa faktuaalista oikeellisuutta**. Virheitä voi joskus syntyä. Kysymysten tarkistus/hyväksyntä ennen peliä on hyvä jatkokehityskohde.

**Kustannukset:** Supabasella ja Netlifyllä on käyttörajoja ja maksullisia palvelutasoja. Google Gemini API veloitetaan erikseen käytön mukaan. Aseta API-hankkeelle käyttöbudjetti ja rajoitukset; tässä ensimmäisessä versiossa ei ole julkisen pelinluonnin väärinkäytön estävää IP-/käyttäjäkohtaista ratelimiteriä. Älä julkaise avaimia näkyville.

**Tuotantokehitys:** Lisää ennen laajaa julkista käyttöä luontipyyntöjen rate limiting, vanhojen huoneiden automaattinen poisto, mahdollisuus poistaa pelaajia/luoda uusintapeli samoilla pelaajilla ja tekoälykysymysten faktatarkistus. Kellonajat tulevat palvelimelta; selain näyttää niiden perusteella jäljellä olevan ajan. Pelin eteneminen tarvitsee vähintään yhden aktiivisen asiakkaan tekemän tilapyynnön.

## Hakemistorakenne

```text
netlify-tietovisa/
├── public/
│   ├── index.html         # käyttöliittymän rakenne
│   ├── style.css          # mobiili- ja desktop-ulkoasu
│   └── app.js             # selainpuolen pelilogiikka
├── netlify/
│   └── functions/
│       ├── api.mjs        # Netlify API + Gemini-kysymysgenerointi
│       └── question-bank.mjs # 50 valmista demokysymystä
├── supabase.sql           # tietokantataulut ja palvelimen RPC-funktiot
├── netlify.toml           # Netlify-konfiguraatio
├── .env.example           # ympäristömuuttujien malli
└── README.md
```

### Sääntöjen muuttaminen

- Maksimipelaajamäärä: `supabase.sql` → `quiz_join_room` (tällä hetkellä 10).
- Pistelaskenta: `supabase.sql` → `quiz_submit_answer` (600–1000 pistettä).
- Paljastusajan pituus: `supabase.sql` → `quiz_advance_room` (6 s) ja `public/app.js` → `updateClock` (6000 ms).
- AI-prompti ja oletusmalli: `netlify/functions/api.mjs` → `generateQuestions`.
- Demokysymykset: `netlify/functions/question-bank.mjs`.

Lähdekoodi on tarkoitettu omaksi muokattavaksi pohjaksi. Tietokantaa ja ulkoisia API-kutsuja ei voida kokeilla loppuun ennen kuin lisäät omat avaimet.

## Gemini API:n käyttöönotto (ilmainen kiintiö)

1. Avaa [Google AI Studio](https://aistudio.google.com/apikey) ja kirjaudu Google-tilillä.
2. Luo API-avain projektille, jossa on maksuton käyttö eikä maksullista laskutusta ole aktivoitu. Tarkista kulloinkin voimassa olevat kiintiöt ja saatavuus Google AI Studiosta.
3. Lisää Netlifyn **Project configuration → Environment variables** -kohtaan `GEMINI_API_KEY` ja sen arvoksi luomasi avain. Halutessasi lisää `GEMINI_MODEL=gemini-2.5-flash-lite`.
4. Poista vanhat `OPENAI_API_KEY` ja `OPENAI_MODEL` Netlifyn asetuksista: niitä ei enää käytetä.
5. Tee Netlifyssä uusi deploy ja kokeile luoda peli.

Gemini-avainta ei koskaan laiteta HTML:ään, selaimen JavaScriptiin eikä GitHubiin. Avain kulkee vain Netlify-palvelinfunktiosta Googlelle. Jos Gemini palauttaa kiintiövirheen 429 tai tilapäisen 503-virheen, peli käyttää demokysymyksiä; muissa API-virheissä pelinluonti näyttää virheen. Generoituja kysymyksiä ei tässä versiossa tallenneta erilliseen uudelleenkäytettävään kysymyspankkiin, vaan ne tallentuvat kyseiseen pelihuoneeseen. Kysymysten faktuaalista oikeellisuutta ei voida taata automaattisesti.


## Automaattisesti kasvava kysymyspankki (uusi versio)

- Jokainen uusi peli pyytää Geminiä luomaan pelin kysymykset sekä **10 ylimääräistä varakysymystä** (kahdessa erässä).
- Kaikki onnistuneesti generoidut kysymykset tallennetaan Supabasen `quiz_question_bank`-tauluun. Saman kysymystekstin normalisoitu SHA-256-tunniste estää täsmällisten tekstimuunnelmien tallentamisen kahdesti. Semanttisesti samansisältöiset eri tavoin kirjoitetut kysymykset voivat silti toistua.
- Pelissä suositaan uusia kysymyksiä. Jos uusia ei saada tarpeeksi, käytetään saman aihealueen ja vaikeustason vähiten käytettyjä kysymyksiä. Viimeisenä varana käytetään mukana tulevia yleissivistäviä demokysymyksiä.
- Ilman `GEMINI_API_KEY`-avainta peli toimii kysymyspankilla ja demokysymyksillä. Ilmaiskiintiö ei ole rajaton; kysymysten generointi voi myös epäonnistua muista syistä.
- **Tärkeä päivitys vanhaan Supabaseen:** suorita **päivitetty koko `supabase.sql`** Supabase SQL Editorissa uudelleen, sillä myös `quiz_create_room`-funktion sallittuja lähdearvoja on muutettu. SQL käyttää `create or replace`-rakennetta eikä poista aiempia pelihuoneita. Ota silti varmuuskopio ennen muutoksia.
- Aihealueet ja vaikeustasot erotellaan pankissa. Jos pankissa ei ole sopivaa aihetta, käytetään viimeisenä varana yleistietoa. Kysymyksiä ei ole faktantarkistettu automaattisesti ulkoisista lähteistä.
- Tarkista toiminta komennoilla `node tests/bank.mjs` ja `node tests/smoke.mjs` (testit simuloivat ulkoiset palvelut).
