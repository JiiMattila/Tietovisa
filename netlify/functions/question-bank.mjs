// Alkuperäiset, paikalliset esimerkkikysymykset. AI-avain mahdollistaa vapaat aihealueet.
const bank = [
  ['Minkä maan pääkaupunki on Canberra?',['Kanada','Australia','Uusi-Seelanti','Etelä-Afrikka','Yhdysvallat'],1,'Canberra on Australian pääkaupunki.'],
  ['Mikä alkuaine on kemialliselta merkiltään Fe?',['Fluori','Fosfori','Rauta','Hopea','Kupari'],2,'Fe tarkoittaa rautaa (latinaksi ferrum).'],
  ['Kuinka monta pelaajaa jalkapallojoukkueella on kentällä ottelun alkaessa?',['9','10','11','12','13'],2,'Jalkapallossa aloittaa 11 pelaajaa joukkuetta kohti.'],
  ['Kuka kirjoitti romaanin Seitsemän veljestä?',['Mika Waltari','Aleksis Kivi','Juhani Aho','Väinö Linna','Eino Leino'],1,'Seitsemän veljestä on Aleksis Kiven romaani.'],
  ['Mikä planeetta on lähimpänä Aurinkoa?',['Venus','Mars','Merkurius','Maa','Jupiter'],2,'Merkurius on aurinkokunnan sisin planeetta.'],
  ['Mikä on Suomen pisin joki?',['Kemijoki','Kymijoki','Oulujoki','Tornionjoki','Kokemäenjoki'],0,'Kemijokea pidetään Suomen pisimpänä jokena.'],
  ['Missä kaupungissa sijaitsee Colosseum?',['Ateena','Milano','Rooma','Madrid','Napoli'],2,'Colosseum sijaitsee Roomassa.'],
  ['Mikä nisäkäs pystyy oikeasti lentämään?',['Liito-orava','Lepakko','Lentokala','Kenguru','Muurahaiskarhu'],1,'Lepakot ovat ainoita aktiiviseen lentoon kykeneviä nisäkkäitä.'],
  ['Minkä maan valuutta on jeni?',['Kiina','Etelä-Korea','Japani','Thaimaa','Vietnam'],2,'Japanin rahayksikkö on jeni.'],
  ['Kuinka monta minuuttia on kolmessa tunnissa?',['120','150','180','210','240'],2,'3 × 60 = 180 minuuttia.'],
  ['Mikä on veden kemiallinen kaava?',['CO₂','H₂O','NaCl','O₂','H₂SO₄'],1,'Vesimolekyylissä on kaksi vetyatomia ja yksi happiatomi.'],
  ['Mikä on maailman suurin valtameri pinta-alaltaan?',['Atlantti','Intian valtameri','Jäämeri','Tyynimeri','Eteläinen jäämeri'],3,'Tyynimeri on valtameristä laajin.'],
  ['Kuka maalasi Mona Lisan?',['Pablo Picasso','Vincent van Gogh','Claude Monet','Leonardo da Vinci','Michelangelo'],3,'Mona Lisa on Leonardo da Vincin maalaus.'],
  ['Minkä eläimen poikasta kutsutaan varsaksi?',['Lehmä','Hevonen','Lammas','Sika','Kissa'],1,'Hevosen poikanen on varsa.'],
  ['Mikä seuraavista on ohjelmointikieli?',['HTML','HTTP','Python','JPEG','CSS'],2,'Python on yleiskäyttöinen ohjelmointikieli.'],
  ['Minkä maan lipussa on punainen vaahteranlehti?',['Sveitsi','Tanska','Kanada','Itävalta','Norja'],2,'Kanadan lipussa on punainen vaahteranlehti.'],
  ['Mikä on ihmisen suurin elin pinta-alaltaan?',['Maksa','Keuhkot','Iho','Sydän','Munuaiset'],2,'Iho on ihmisen suurin elin.'],
  ['Kuinka monta sivua on kuusikulmiolla?',['4','5','6','7','8'],2,'Kuusikulmiossa on kuusi sivua.'],
  ['Kuka sävelsi teoksen Finlandia?',['Jean Sibelius','Toivo Kuula','Oskar Merikanto','Kaija Saariaho','Leevi Madetoja'],0,'Finlandia on Jean Sibeliuksen sävellys.'],
  ['Mikä on kultaa tarkoittava kemiallinen merkki?',['Ag','Au','Al','Pt','Cu'],1,'Au tulee kullan latinankielisestä nimestä aurum.'],
  ['Mikä on Kreikan pääkaupunki?',['Thessaloniki','Ateena','Patras','Heraklion','Rodos'],1,'Ateena on Kreikan pääkaupunki.'],
  ['Mikä näistä on aurinkokunnan kaasuplaneetta?',['Mars','Venus','Merkurius','Jupiter','Maa'],3,'Jupiter koostuu pääasiassa vedystä ja heliumista.'],
  ['Missä urheilulajissa käytetään kiekkoa ja mailaa jäällä?',['Salibandy','Jääkiekko','Pallopeli','Pesäpallo','Kriketti'],1,'Jääkiekkoa pelataan jäällä kiekolla ja mailoilla.'],
  ['Mikä kieli kuuluu romaanisiin kieliin?',['Suomi','Ruotsi','Venäjä','Espanja','Unkari'],3,'Espanja kehittyi latinasta.'],
  ['Kuinka monta tavua on sanassa "omena"?',['2','3','4','5','6'],1,'O-me-na: kolme tavua.'],
  ['Mikä on Afrikan pinta-alaltaan suurin valtio?',['Nigeria','Etelä-Afrikka','Egypti','Algeria','Kenia'],3,'Algeria on Afrikan suurin valtio pinta-alaltaan.'],
  ['Mikä on Suomen kansallislintu?',['Laulujoutsen','Merikotka','Kurki','Huuhkaja','Teeri'],0,'Laulujoutsen on Suomen kansallislintu.'],
  ['Kuka tunnetaan suhteellisuusteorian kehittäjänä?',['Isaac Newton','Albert Einstein','Nikola Tesla','Galileo Galilei','Marie Curie'],1,'Albert Einstein kehitti erityisen ja yleisen suhteellisuusteorian.'],
  ['Mikä kaasu muodostaa suurimman osan Maan ilmakehästä?',['Happi','Typpi','Hiilidioksidi','Argon','Vety'],1,'Ilmakehästä noin 78 % on typpeä.'],
  ['Mikä merkitsee lämpötilan SI-perusyksikköä?',['Celsiusaste','Kelvin','Fahrenheitaste','Joule','Watti'],1,'Kelvin (K) on termodynaamisen lämpötilan SI-perusyksikkö.'],
  ['Mikä on antiikin Egyptin kirjoitusjärjestelmä?',['Kiilakirjoitus','Riimukirjoitus','Hieroglyfit','Latinalaiset aakkoset','Morseaakkoset'],2,'Hieroglyfit olivat antiikin Egyptin kirjoitusmerkkejä.'],
  ['Mikä on Tokion sijaintimaa?',['Kiina','Japani','Taiwan','Etelä-Korea','Mongolia'],1,'Tokio on Japanin pääkaupunki.'],
  ['Mikä instrumentti on tavallisesti varustettu 88 koskettimella?',['Harmonikka','Kitara','Piano','Huilu','Viulu'],2,'Tavallisessa täysikokoisessa pianossa on 88 kosketinta.'],
  ['Mikä seuraavista on alkuluku?',['21','27','29','33','35'],2,'Luku 29 on jaollinen vain yhdellä ja itsellään.'],
  ['Mikä planeetta tunnetaan punaisena planeettana?',['Saturnus','Mars','Neptunus','Uranus','Venus'],1,'Mars näyttää punertavalta pintansa rautaoksidin vuoksi.'],
  ['Mikä on Euroopan unionin parlamentin vaalien tavallinen vaalikausi?',['3 vuotta','4 vuotta','5 vuotta','6 vuotta','7 vuotta'],2,'Euroopan parlamentti valitaan viideksi vuodeksi.'],
  ['Missä maassa sijaitsee Machu Picchu?',['Chile','Peru','Bolivia','Ecuador','Kolumbia'],1,'Machu Picchu sijaitsee Perussa.'],
  ['Mikä valtio tunnetaan tulppaanien viljelystä ja tuulimyllyistä?',['Belgia','Tšekki','Alankomaat','Irlanti','Luxemburg'],2,'Alankomaat on kuuluisa tulppaaneista ja tuulimyllyistä.'],
  ['Mikä osa kasvista ottaa pääasiassa vettä maaperästä?',['Kukka','Lehti','Juuri','Hedelmä','Siemen'],2,'Kasvin juuret ottavat vettä ja ravinteita maaperästä.'],
  ['Mikä on Maan luonnollinen kiertolainen?',['Phobos','Europa','Kuu','Titan','Io'],2,'Kuu kiertää Maata.'],
  ['Mikä maa voitti jalkapallon miesten maailmanmestaruuden vuonna 2022?',['Ranska','Brasilia','Argentiina','Saksa','Kroatia'],2,'Argentiina voitti vuoden 2022 miesten jalkapallon MM-kisat.'],
  ['Mitä yksikköä käytetään sähkövirran mittaamiseen?',['Voltti','Ohmi','Ampeeri','Watti','Joule'],2,'Sähkövirran SI-yksikkö on ampeeri (A).'],
  ['Mikä elin pumppaa verta ihmiskehoon?',['Maksa','Sydän','Haima','Munuainen','Perna'],1,'Sydän pumppaa verta verenkiertoon.'],
  ['Mikä seuraavista väreistä saadaan sekoittamalla sinistä ja keltaista maalia?',['Purppura','Oranssi','Vihreä','Punainen','Ruskea'],2,'Perinteisessä maalisekoituksessa sininen ja keltainen muodostavat vihreää.'],
  ['Mikä valtio sijaitsee Iberian niemimaalla?',['Puola','Portugali','Kreikka','Unkari','Norja'],1,'Portugali sijaitsee Iberian niemimaalla.'],
  ['Mikä on aurinkokuntamme tähti?',['Sirius','Aurinko','Vega','Betelgeuse','Proxima Centauri'],1,'Aurinko on aurinkokuntamme keskustähti.'],
  ['Mikä seuraavista on merieläin?',['Hirvi','Delfiini','Ilves','Poro','Orava'],1,'Delfiinit ovat vedessä eläviä nisäkkäitä.'],
  ['Mihin maahan Eiffel-torni kuuluu?',['Italia','Saksa','Ranska','Espanja','Belgia'],2,'Eiffel-torni sijaitsee Pariisissa, Ranskassa.'],
  ['Mikä on neliön sisäkulmien summa?',['180°','270°','360°','450°','540°'],2,'Nelikulmion sisäkulmien summa on 360 astetta.'],
  ['Mikä on ensimmäinen alkuaine jaksollisessa järjestelmässä?',['Helium','Vety','Happi','Hiili','Litium'],1,'Vedyn järjestysluku on 1.']
];

export function getDemoQuestions(count) {
  // Turvallinen järjestyssekoitus ja kunkin kysymyksen vastausvaihtoehtojen sekoitus.
  const shuffled = [...bank].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map(([text, options, answerIndex, explanation]) => {
    const shuffledOptions = options.map((value, index) => ({ value, index }))
      .sort(() => Math.random() - 0.5);
    return {
      text,
      options: shuffledOptions.map(({ value }) => value),
      answerIndex: shuffledOptions.findIndex(({ index }) => index === answerIndex),
      explanation
    };
  });
}
