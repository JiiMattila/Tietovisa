# Nörttien Arvauskeskus – moninpelattava tietokilpailu Netlifyyn

Nörttien Arvauskeskus on selainpohjainen tietovisa. Yhdessä huoneessa voi olla **enintään 10 pelaajaa** (pelin luoja mukaan lukien). Peli käynnistyy automaattisesti, kun kaikki huoneessa ovat valmiina.

## Ominaisuudet

- Pelin luonti ja **6-merkkinen liittymiskoodi**; kaverin voi kutsua linkillä.
- 5/10/15/20/30 kysymystä, **viisi vastausvaihtoehtoa** ja aina yksi oikea.
- Valittava vastausaika (10–60 sekuntia) ja kolme vaikeustasoa.
- Sama kysymys kaikille. Valintaa voi vaihtaa, kunnes kaikki ovat vastanneet tai vastausaika päättyy.
- **Kaikki aihealueet** kokoaa kysymykset koko pankista. **Pelaajien valitsemat** käyttää odotushuoneessa varattuja aiheita. Jokainen voi varata yhden vapaan aiheen. Kysymyksen oma aihealue näkyy pelissä.
- Oikeasta lopullisesta valinnasta saa 600–1000 pistettä sen lähetysajan mukaan.
- Välitulokset, oikean vastauksen paljastus ja lopulliset sijoitukset.
- Pelin päättyessä arvottu Matti Nykäsen lausahdus näkyy kaikille pelaajille voittajan nimen alla.
- Tulosruudun **Pelaa uudestaan** lähettää muille pelaajille 30 sekunnin uusintakutsun. Hyväksyneet siirtyvät uuteen odotushuoneeseen samalla aihevalintatavalla.
- Puhelimilla toimiva responsiivinen käyttöliittymä, ei rekisteröitymistä.
- Taustamusiikki ja peliäänet käynnistyvät sivun ensimmäisen painalluksen jälkeen. Yläreunan kytkimet säätävät niitä erikseen, ja selain muistaa valinnat.
- Gemini luo uusia kysymyksiä molemmissa aihevalintatavoissa ja uusintapeleissä. API-asiakkaat voivat edelleen määrittää oman aiheensa.
- Ilman Gemini-avainta käytettävissä ovat kysymyspankki ja **120 valmista yleistietokysymystä**. Demotilassa valittu aihealue ja vaikeustaso eivät muuta kysymyksiä.

## Mitä tarvitaan?

1. [Supabase](https://supabase.com/) – pelien ja pelaajien yhteinen tietokanta.
2. [Netlify](https://www.netlify.com/) – selainkäyttöliittymän ja palvelinfunktioiden julkaisu.
3. Valinnainen [Google Gemini API](https://aistudio.google.com/) – uudet pelikysymykset ja kysymyspankin täydentäminen. **Geminin maksuttomalla API-tasolla on käyttörajoitukset.**

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
  | `GEMINI_MODEL` | Valinnainen, oletus `gemini-3.5-flash-lite` |

- Tee uusi deploy, kun ympäristömuuttujat on lisätty.
- Avaa Netlifyn antama `https://...netlify.app`-osoite.

**Vaihtoehto GitHubille:** Netlify CLI:llä voi julkaista koko projektin sen juurihakemistosta (`netlify login`, `netlify init`, `netlify deploy --build --prod`), mutta lisää ympäristömuuttujat ensin Netlifyssä.

### 4. Kokeile kahdella laitteella

- Avaa sama Netlify-sivusto kahdella puhelimella tai kahdessa eri selaimessa.
- Ensimmäinen luo pelin ja valitsee nimimerkin. Hän näkyy itse pelaajalistassa.
- Toinen syöttää annetun koodin ja oman nimimerkin.
- Jos käytössä on **Pelaajien valitsemat**, molemmat varaavat eri aihealueen. Aiheen vaihtaminen peruu pelaajan valmiusmerkinnän.
- Molemmat painavat **Valmiina**. Peli alkaa, kun molemmat ovat valmiina. Kysymysten ja tulosten pitäisi päivittyä kummassakin laitteessa noin 1–2 sekunnin välein.

## Pelin toiminta ja rajoitukset

**Palvelintekniikka:** Netlify Function käsittelee pyynnöt `/api/create`, `/api/join`, `/api/topic`, `/api/ready`, `/api/answer`, `/api/rematch` ja `/api/state`. Funktio käyttää Supabasen Data REST API:a ja tietokantafunktioita (RPC). Pelilogiikka, vastausten oikeellisuus ja pisteytys pysyvät palvelinpuolella. Selain ei saa oikeaa vastausta ennen kierroksen paljastusvaihetta. Selain pollaa tilaa 1,25 sekunnin välein; erillistä Supabase Realtime -yhteyttä ei tarvita.

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
│       └── question-bank.mjs # 120 valmista demokysymystä
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
3. Lisää Netlifyn **Project configuration → Environment variables** -kohtaan `GEMINI_API_KEY` ja sen arvoksi luomasi avain. `GEMINI_MODEL` on valinnainen.
4. Poista vanhat `OPENAI_API_KEY` ja `OPENAI_MODEL` Netlifyn asetuksista: niitä ei enää käytetä.
5. Tee Netlifyssä uusi deploy ja kokeile luoda peli.

Gemini-avainta ei koskaan laiteta HTML:ään, selaimen JavaScriptiin eikä GitHubiin. Avain kulkee vain Netlify-palvelinfunktiosta Googlelle. Jos kysymysten generointi epäonnistuu, peli käyttää kysymyspankkia ja tarvittaessa demokysymyksiä. Kysymysten faktuaalista oikeellisuutta ei voida taata automaattisesti.


## Automaattisesti kasvava kysymyspankki

- Kaikkien aihealueiden pelissä Geminiltä pyydetään kysymykset huonetta luotaessa. Pelaajien valitsemissa aiheissa ja uusintapeleissä kysymykset haetaan, kun kaikki ovat valmiita.
- Peli pyytää samalla **20 ylimääräistä kysymystä** eri aihealueilta. Aiheet jaetaan tasaisesti, ja useammin käytettävät aiheet arvotaan. Ylimääräiset kysymykset tallennetaan pankkiin tulevia pelejä varten.
- Uudet, suodatetut Gemini-kysymykset tallennetaan Supabasen `quiz_question_bank`-tauluun. Normalisoitu kysymystunniste estää saman kysymystekstin tallentamisen kahdesti.
- Peli vertaa kysymyksiä kymmenen viimeisimmän huoneen kysymyksiin. Gemini saa aiempia kysymystekstejä vältettäväksi, ja peli suodattaa myös läheiset sanamuodot, joilla on sama oikea vastaus.
- Pelin aihealueet ovat maantieto, historia, tiede, luonto, kirjallisuus ja taide, musiikki, suomalainen musiikki, elokuvat, urheilu, teknologia, matematiikka sekä ruoka ja juoma. Peli suosii kysymyksiä, joita ei ole ollut viime peleissä. Pelaajien valitsemassa pelissä kysymykset poimitaan mahdollisimman tasaisesti varatuista aiheista ja niitä täydennetään tarvittaessa saman aiheen lähimmältä vaikeustasolta. Jos kysymyksiä on vähemmän kuin pelaajia, mukaan mahtuvat aiheet arvotaan.
- Jos Gemini ei tuota tarpeeksi uusia kysymyksiä, peli täydentää kierrokset kysymyspankista. Kaikkien aihealueiden peleissä on myös demovaravalikoima. Jos varavalikoima on jo käyty läpi, pisimpään poissa olleet kysymykset palaavat ensin.
- Ilman `GEMINI_API_KEY`-avainta peli toimii kysymyspankilla ja demokysymyksillä. Ilmaiskiintiö ei ole rajaton; kysymysten generointi voi myös epäonnistua muista syistä.
- Asenna päivitetty `supabase.sql` ennen Netlify-julkaisua. Se sisältää odotushuoneen kysymyshaun käyttämät tietokantafunktiot.
- Aihealueet ja vaikeustasot erotellaan pankissa. Jos pankissa ei ole sopivaa aihetta, käytetään viimeisenä varana yleistietoa. Kysymyksiä ei ole faktantarkistettu automaattisesti ulkoisista lähteistä.
- Tarkista toiminta ajamalla `node --test tests/*.mjs`. Testit simuloivat Geminiä ja Supabase-yhteyttä.
