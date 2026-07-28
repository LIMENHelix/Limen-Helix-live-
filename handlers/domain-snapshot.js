/**
 * api/domain-snapshot.js
 * Vercel serverless — aggregated domain feed matrix
 *
 * 2 real sources per domain, 20 domains = 40 source fetches.
 * Returns one compact JSON payload for the browser.
 * Falls back per-source gracefully.
 *
 * Hardened: retry with backoff, per-source health tracking,
 * freshness discipline, error labeling, graceful degradation.
 *
 * Keys from env: FRED_API_KEY, EIA_API_KEY, NOAA_TOKEN, USPTO_API_KEY
 * No-key APIs: openFDA, arXiv, PubMed, BLS v2
 */

var db = require('../lib/limen-db');

var TIMEOUT = 5000;
var RETRY_DELAY = 800;
var MAX_RETRIES = 1;

// ─── GDELT response cache (persists across invocations on warm lambda) ──
var _gdeltCache = {}; // key → { data, cachedAt }
var _GDELT_CACHE_TTL = 300000; // 5 minutes
var _GDELT_STAGGER_MS = 600; // delay between sequential GDELT calls

function _gdeltCacheGet(key) {
  var entry = _gdeltCache[key];
  if (entry && (Date.now() - entry.cachedAt) < _GDELT_CACHE_TTL) return entry.data;
  return null;
}

function _gdeltCacheSet(key, data) {
  _gdeltCache[key] = { data: data, cachedAt: Date.now() };
}

// ─── Source health tracking (per invocation) ──────────────────────────

var _sourceHealth = {};

function trackHealth(name, domain, status, reason, value) {
  _sourceHealth[name] = {
    domain: domain,
    status: status,
    reason: reason || null,
    fetchedAt: Date.now(),
    value: value !== undefined ? value : null,
    usingFallback: status !== 'live'
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=25, stale-while-revalidate=10');

  _sourceHealth = {};

  try {
    // Stagger arXiv fetches to avoid rate limit (3 req/s)
    // BLS fetches share a 25/day quota — both still needed
    // Fetch non-GDELT sources in parallel (indices 0-13, 14, 16-24, 26, 28, 31-37, 39)
    // SOURCE_KEYS — name-keyed binding aligned to the Promise.allSettled
    // fetcher list. Reordering, inserting, or removing a fetcher requires the
    // matching SOURCE_KEYS entry to move with it. Each domain reads its data
    // by stable string key (byKey('FRED')), so a slot can never silently
    // bind to another fetcher's output.
    var SOURCE_KEYS = [
        "FRED",
        "BLS",
        "EIA",
        "FREDEnergy",
        "NOAAClimate",
        "NOAAAlerts",
        "FDAEvents",
        "FDARecalls",
        "Patents",
        "ArXivCS",
        "PubMed",
        "ArXivAll",
        "BLSFreight",
        "EIASupply",
        "WorldBankGovernance",
        "WorldBankInfra",
        "OECDInfra",
        "USDA",
        "FAO",
        "FREDIndustry",
        "BLSManufacturing",
        "WorldBankEducation",
        "OpenAlex",
        "NewsAPI",
        "EventRegistryCulture",
        "RSSDefense",
        "RSSReligion",
        "WorldBankPopulation",
        "UNPopulation",
        "FederalRegister",
        "RegulationsGov",
        "AlphaVantage",
        "Finnhub",
        "Tavily",
        "RSSGovernance",
        "RSSMedia",
        "RSSCulture",
        "RSSConflict",
        "RSSIntel",
        "RSSSupplyChain",
        "RSSAgriculture",
        "MassiveCrudeOil",
        "MassiveSPY",
        "RSSReligionEvents",
        "FREDConstructionSpending",
        "FREDTransportationIndex",
        "FREDFederalInvestment",
        "FREDGasPrice",
        "FREDFoodCPI",
        "FREDConsumerSentiment",
        "CourtListener",
        "PACERDocket",
        "DOJPressReleases",
        "SECEnforcement",
        "CFPBEnforcement",
        "USCourtsFederalCaseload",
        "AFCARSFamilyCourt",
        "SCOTUSOpinions",
        "NSFAwards",
        "RetractionWatch",
        "NIHGrants",
        "NatureScience",
        "CDCMMWR",
        "WHODiseaseOutbreak",
        "FDADrugShortages",
        "ClinicalTrials",
        "EDGovNews",
        "NCESNews",
        "EdWeekNews",
        "IESNews",
        "ChronicleHigherEd",
        "CISAKEV",
        "NVDRecent",
        "KrebsSecurity",
        "HackerNews",
        "GitHubSecurityAdvisories",
        "RSF",
        "CPJ",
        "Snopes",
        "Poynter",
        "NiemanLab",
        "DefenseNews",
        "BreakingDefense",
        "ISW",
        "RUSI",
        "NATONews",
        "DefenseOne",
        "TheWarZone",
        "CSIS",
        "SIPRI",
        "TASS",
        "Xinhua",
        "GlobalTimes",
        "PressTV",
        "KCNAWatch",
        "SCMP",
        "GovTrack",
        "CongressGov",
        "GAOReports",
        "CBOPublications",
        "OMBReleases",
        "BrennanCenter",
        "POGO",
        "MotherJones",
        "HuffPostPolitics",
        "TheNation",
        "Breitbart",
        "WashingtonTimes",
        "NationalReview",
        "DailyCaller",
        "EPANews",
        "NOAAResearch",
        "USGSNews",
        "GlobalForestWatchNews",
        "IUCNNews",
        "InsideClimateNews",
        "GristEnv",
        "NHTSARecalls",
        "CPSCRecalls",
        "PHMSAIncidents",
        "CSBInvestigations",
        "UAWStrikeTracker",
        "EIAWeeklyPetroleum",
        "EIANaturalGas",
        "EIAElectricity",
        "IEANews",
        "OPECBasket",
        "SolarIndustryNews",
        "WindEnergyNews",
        "NuclearEnergyNews",
        "HydrogenEnergyNews",
        "GridReliabilityNews",
        "EnergyStorageNews",
        "LNGMarketNews",
        "CoalTransitionNews",
        "RecordedFutureIntel",
        "CISAAlerts",
        "NSACybersecurityAdvisories",
        "FBICyberDiv",
        "DNIAnnualThreat",
        "CyberScoopNews",
        "TheRecord",
        "LawfareNatSec",
        "BellingcatOSINT",
        "InterceptNatSec",
        "NEANews",
        "NEHNews",
        "UNESCOCulture",
        "PENAmerica",
        "ArtNewspaper",
        "Variety",
        "Hypebeast",
        "Pitchfork",
        "UNFPA",
        "CDCNCHS",
        "WHOGHO",
        "UNHCRDisplacement",
        "IOMmigration",
        "IHMEPopHealth",
        "GuttmacherInstitute",
        "CensusBureau",
        "OurWorldInDataPop",
        "PopulationMatters",
        "VaticanNews",
        "AlJazeeraReligion",
        "ChristianityToday",
        "ReligionNewsService",
        "USCIRF",
        "PewReligion",
        "TimesOfIsraelReligion",
        "HindustanTimesReligion",
        "BuddhistDoorGlobal",
        "SikhNetNews",
        "MormonNewsroom",
        "JWNews",
        "OrthodoxChristianity",
        "IslamicFinanceNews",
        "JewishTelegraphicAgency",
        "CatholicNewsAgency",
        "EsotericSpirituality",
        "MindfulnessIndustry",
        "SECEDGARCurrent",
        "TreasuryYieldCurve",
        "TreasuryDebt",
        "FedH41",
        "FDICBankFailures",
        "OCCEnforcement",
        "CFTCPress",
        "FINRADisciplinary",
        "NYFedSOFR",
        "NCUACreditUnion",
        "NOAANWSAlerts",
        "USGSEarthquakes",
        "CISAKEV_2",
        "FedRegCBP",
        "FedRegCoastGuard",
        "FedRegFAA",
        "FedRegNHTSA",
        "FedRegFMCSA",
        "FedRegUSTR",
        "OFACRecentActions",
        "USDADroughtMonitor",
        "NOAACPCDrought",
        "NOAANWSAgAlerts",
        "FDARecalls_2",
        "FedRegUSDA",
        "FedRegFDA",
        "FedRegEPA",
        "FedRegAPHIS",
        "FedRegFSIS",
        "WorldBankFoodIndex",
        "TreasuryMTS",
        "TreasuryOperatingCash",
        "TreasuryDebtOutstanding",
        "FedMonetaryPress",
        "FedRegFedReserve",
        "FedRegTreasury",
        "FedRegIRS",
        "NYFedEFFR",
        "WorldBankGDPGrowth",
        "WorldBankInflation",
        "FedRegOSHA",
        "FedRegMSHA",
        "FedRegBIS",
        "FedRegDOL",
        "FedRegFERC",
        "FedRegDHS",
        "FedRegDOT",
        "FedRegHUD",
        "CISAAdvisories",
        "FedRegArmyCorps",
        "FedRegDOE",
        "FedRegNRC",
        "FedRegDoD",
        "FedRegStateDept",
        "FedRegFBI",
        "FedRegCIA",
        "FedRegNSA",
        "FedRegEOP",
        "FedRegInterior",
        "FedRegHHS",
        "FedRegCDC",
        "FedRegCMS",
        "FedRegNIH",
        "FedRegNSF",
        "FedRegEducation",
        "FedRegNASA",
        "FedRegSmithsonian",
        "WorldBankRD",
        "FedRegFCC",
        "FedRegNIST",
        "FedRegFTC",
        "WorldBankTertiary",
        "WorldBankFertility",
        "FedRegCensus",
        "FedRegSSA",
        "FedRegDOJ",
        "FedRegDEA",
        "FedRegBOP",
        "FedRegPTO",
        "BBCWorldNews",
        "WBGovEffectiveness",
        "WBRuleOfLaw",
        "WBInternetUsers",
        "WBLogisticsLPI",
        "WBManufacturing",
        "SpotifyCharts",
        "BillboardCharts",
        "GeniusCommentary",
        "SongkickTours",
        "SoundcloudEmerging",
        "MusicSceneDiscourse"
      ];
    var nonGdeltResults = await Promise.allSettled([
      fetchFRED(),                // 0: economy A
      fetchBLS(),                 // 1: economy B
      fetchEIA(),                 // 2: energy A
      fetchFREDEnergy(),          // 3: energy B
      fetchNOAAClimate(),         // 4: environment A
      fetchNOAAAlerts(),          // 5: environment B
      fetchFDAEvents(),           // 6: health A
      fetchFDARecalls(),          // 7: health B
      fetchPatents(),             // 8: technology A
      fetchArXivCS(),             // 9: technology B
      fetchPubMed(),              // 10: research A
      fetchArXivAll(),            // 11: research B
      fetchBLSFreight(),          // 12: supplyChain A
      fetchEIASupply(),           // 13: supplyChain B
      fetchWorldBankGovernance(), // 14: governance A
      fetchWorldBankInfra(),      // 15: infrastructure A (was 16)
      fetchOECDInfra(),           // 16: infrastructure B (was 17)
      fetchUSDA(),                // 17: agriculture A (was 18)
      fetchFAO(),                 // 18: agriculture B (was 19)
      fetchFREDIndustry(),        // 19: industry A (was 20)
      fetchBLSManufacturing(),    // 20: industry B (was 21)
      fetchWorldBankEducation(),  // 21: education A (was 22)
      fetchOpenAlex(),            // 22: education B (was 23)
      fetchNewsAPI(),             // 23: communication A (was 24)
      fetchEventRegistryCulture(),// 24: culture A (was 26)
      fetchRSSDefense(),            // 25: defense A (replaces ACLED — always works)
      fetchRSSReligion(),           // 26: religion B (replaces Event Registry Religion)
      fetchWorldBankPopulation(), // 27: population A (was 32)
      fetchUNPopulation(),        // 28: population B (was 33)
      fetchFederalRegister(),     // 29: law A (was 34)
      fetchRegulationsGov(),      // 30: law B (was 35)
      fetchAlphaVantage(),        // 31: finance A (was 36)
      fetchFinnhub(),             // 32: finance B (was 37)
      fetchTavily(),              // 33: intelligence B (was 39)
      fetchRSSGovernance(),       // 34: governance B (replaces GDELT Governance)
      fetchRSSMedia(),            // 35: communication B (replaces GDELT Media)
      fetchRSSCulture(),          // 36: culture B (replaces GDELT Tone)
      fetchRSSConflict(),         // 37: defense B (replaces GDELT Conflict)
      fetchRSSIntel(),            // 38: intelligence A (replaces GDELT Intel)
      fetchRSSSupplyChain(),      // 39: supplyChain B (replaces EIA Supply for real-time)
      fetchRSSAgriculture(),      // 40: agriculture B (real-time food/crop signals)
      fetchMassiveCrudeOil(),     // 41: energy — real-time crude oil price
      fetchMassiveSPY(),          // 42: finance — real-time S&P 500
      fetchRSSReligionEvents(),  // 43: religion A (dedicated — no longer reusing defense)
      fetchFREDConstructionSpending(), // 44: infrastructure C — construction spending
      fetchFREDTransportationIndex(),  // 45: infrastructure D — freight transport index
      fetchFREDFederalInvestment(),     // 46: infrastructure E — federal investment
      fetchFREDGasPrice(),              // 47: economy C — gas price
      fetchFREDFoodCPI(),               // 48: economy D — food CPI
      fetchFREDConsumerSentiment(),     // 49: economy E — consumer sentiment
      fetchCourtListener(),             // 50: law C — federal docket activity (CourtListener REST)
      fetchPACERDocket(),               // 51: law D — federal docket news (RSS proxy; PACER auth not viable)
      fetchDOJPressReleases(),          // 52: law E — DOJ enforcement / prosecution
      fetchSECEnforcement(),            // 53: law F — SEC enforcement (EDGAR AAER full-text)
      fetchCFPBEnforcement(),           // 54: law G — CFPB enforcement (RSS)
      fetchUSCourtsFederalCaseload(),   // 55: law H — uscourts.gov news RSS (civil + criminal + bankruptcy)
      fetchAFCARSFamilyCourt(),         // 56: law I — family law / child welfare (RSS)
      fetchSCOTUSOpinions(),            // 57: law J — Supreme Court opinions (SCOTUSblog RSS)
      fetchNSFAwards(),                 // 58: science C — NSF awards / research news
      fetchRetractionWatch(),           // 59: science D — research integrity / retractions
      fetchNIHGrants(),                 // 60: science E — NIH grants / funding announcements
      fetchNatureScience(),             // 61: science F — Nature / Science magazine press
      fetchCDCMMWR(),                   // 62: medicine C — CDC MMWR public health alerts
      fetchWHODiseaseOutbreak(),        // 63: medicine D — WHO Disease Outbreak News
      fetchFDADrugShortages(),          // 64: medicine E — openFDA drug shortages
      fetchClinicalTrials(),            // 65: medicine F — ClinicalTrials.gov updates
      fetchEDGovNews(),                 // 66: education C — U.S. Dept of Education news RSS
      fetchNCESNews(),                  // 67: education D — National Center for Education Statistics
      fetchEdWeekNews(),                // 68: education E — Education Week news RSS
      fetchIESNews(),                   // 69: education F — Institute of Education Sciences news
      fetchChronicleHigherEd(),         // 70: education G — Chronicle of Higher Education
      fetchCISAKEV(),                   // 71: technology C — CISA Known Exploited Vulnerabilities
      fetchNVDRecent(),                 // 72: technology D — NIST NVD recent CVEs
      fetchKrebsSecurity(),             // 73: technology E — Krebs on Security RSS
      fetchHackerNews(),                // 74: technology F — Hacker News top stories
      fetchGitHubSecurityAdvisories(),  // 75: technology G — GitHub Security Advisories RSS
      fetchRSF(),                       // 76: communication C — Reporters Without Borders
      fetchCPJ(),                       // 77: communication D — Committee to Protect Journalists
      fetchSnopes(),                    // 78: communication E — Snopes Fact Checks
      fetchPoynter(),                   // 79: communication F — Poynter Media News
      fetchNiemanLab(),                 // 80: communication G — Nieman Lab journalism research
      fetchDefenseNews(),               // 81: defense C — Defense News (US)
      fetchBreakingDefense(),           // 82: defense D — Breaking Defense
      fetchISW(),                       // 83: defense E — Institute for the Study of War
      fetchRUSI(),                      // 84: defense F — Royal United Services Institute (UK)
      fetchNATONews(),                  // 85: defense G — NATO official news
      fetchDefenseOne(),                // 86: defense H — Defense One
      fetchTheWarZone(),                // 87: defense I — The War Zone
      fetchCSIS(),                      // 88: defense J — CSIS analysis
      fetchSIPRI(),                     // 89: defense K — SIPRI arms trade and global military
      fetchTASS(),                      // 90: defense L — TASS Russian state news (adversary)
      fetchXinhua(),                    // 91: defense M — Xinhua Chinese state news (adversary)
      fetchGlobalTimes(),               // 92: defense N — Global Times China (adversary)
      fetchPressTV(),                   // 93: defense O — Press TV Iran (adversary)
      fetchKCNAWatch(),                 // 94: defense P — KCNA Watch DPRK (adversary)
      fetchSCMP(),                      // 95: defense Q — South China Morning Post (regional)
      fetchGovTrack(),                  // 96: governance C — GovTrack legislative events
      fetchCongressGov(),               // 97: governance D — Congress.gov bills
      fetchGAOReports(),                // 98: governance E — GAO Reports
      fetchCBOPublications(),           // 99: governance F — CBO Publications
      fetchOMBReleases(),               // 100: governance G — OMB Releases
      fetchBrennanCenter(),             // 101: governance H — Brennan Center
      fetchPOGO(),                      // 102: governance I — Project on Government Oversight
      fetchMotherJones(),               // 103: governance J — Mother Jones (partisan-left)
      fetchHuffPostPolitics(),          // 104: governance K — HuffPost Politics (partisan-left)
      fetchTheNation(),                 // 105: governance L — The Nation (partisan-left)
      fetchBreitbart(),                 // 106: governance M — Breitbart (partisan-right)
      fetchWashingtonTimes(),           // 107: governance N — Washington Times (partisan-right)
      fetchNationalReview(),            // 108: governance O — National Review (partisan-right)
      fetchDailyCaller(),               // 109: governance P — Daily Caller (partisan-right)
      fetchEPANews(),                   // 110: environment C — EPA news releases (institutional)
      fetchNOAAResearch(),              // 111: environment D — NOAA research / climate news (institutional)
      fetchUSGSNews(),                  // 112: environment E — USGS water / earth science news (institutional)
      fetchGlobalForestWatchNews(),     // 113: environment F — Global Forest Watch deforestation alerts (institutional)
      fetchIUCNNews(),                  // 114: environment G — IUCN Red List biodiversity alerts (institutional)
      fetchInsideClimateNews(),         // 115: environment H — Inside Climate News investigative (asymmetric — directional support only)
      fetchGristEnv(),                  // 116: environment I — Grist environmental journalism (asymmetric — directional support only)
      fetchNHTSARecalls(),              // 117: industry C — NHTSA vehicle recalls (institutional)
      fetchCPSCRecalls(),               // 118: industry D — CPSC consumer product recalls (institutional)
      fetchPHMSAIncidents(),            // 119: industry E — PHMSA pipeline and hazmat incidents (institutional)
      fetchCSBInvestigations(),         // 120: industry F — CSB chemical safety investigations (institutional)
      fetchUAWStrikeTracker(),          // 121: industry G — UAW / USW / BLS strike activity tracker
      fetchEIAWeeklyPetroleum(),       // 122: energy D — EIA Weekly Petroleum Status (institutional)
      fetchEIANaturalGas(),            // 123: energy E — EIA Natural Gas Weekly Update (institutional)
      fetchEIAElectricity(),           // 124: energy F — EIA Electricity Monthly (institutional)
      fetchIEANews(),                  // 125: energy G — IEA energy market news (institutional)
      fetchOPECBasket(),               // 126: energy H — OPEC Reference Basket price signal (institutional)
      fetchSolarIndustryNews(),        // 127: energy I — Solar industry news (SEIA, PV Magazine)
      fetchWindEnergyNews(),           // 128: energy J — Wind energy news (AWEA, Windpower Monthly)
      fetchNuclearEnergyNews(),        // 129: energy K — Nuclear energy news (NEI, World Nuclear News)
      fetchHydrogenEnergyNews(),       // 130: energy L — Hydrogen economy news (Hydrogen Council, FuelCellsWorks)
      fetchGridReliabilityNews(),      // 131: energy M — Grid reliability and NERC alerts (FERC, NERC, ISO/RTO)
      fetchEnergyStorageNews(),        // 132: energy N — Battery and energy storage (ESA, energy-storage.news)
      fetchLNGMarketNews(),            // 133: energy O — LNG market and trade (LNG World News, IGU)
      fetchCoalTransitionNews(),        // 134: energy P — Coal retirement and transition (Global Energy Monitor)
      fetchRecordedFutureIntel(),       // 135: intelligence C — Recorded Future threat intelligence (institutional)
      fetchCISAAlerts(),                // 136: intelligence D — CISA cybersecurity alerts (institutional)
      fetchNSACybersecurityAdvisories(),// 137: intelligence E — NSA cybersecurity advisories (institutional)
      fetchFBICyberDiv(),              // 138: intelligence F — FBI Cyber Division alerts (institutional)
      fetchDNIAnnualThreat(),          // 139: intelligence G — ODNI Annual Threat Assessment signals (institutional)
      fetchCyberScoopNews(),           // 140: intelligence H — CyberScoop national security and cyber (institutional)
      fetchTheRecord(),                // 141: intelligence I — The Record by Recorded Future (institutional)
      fetchLawfareNatSec(),            // 142: intelligence J — Lawfare national security analysis (institutional)
      fetchBellingcatOSINT(),          // 143: intelligence K — Bellingcat OSINT investigations (asymmetric — activity only)
      fetchInterceptNatSec(),          // 144: intelligence L — The Intercept national security (asymmetric — activity only)
      fetchNEANews(),                  // 145: culture C — National Endowment for the Arts (institutional, stress)
      fetchNEHNews(),                  // 146: culture D — National Endowment for the Humanities (institutional, stress)
      fetchUNESCOCulture(),            // 147: culture E — UNESCO culture/heritage news (institutional, stress)
      fetchPENAmerica(),               // 148: culture F — PEN America free expression (institutional, stress)
      fetchArtNewspaper(),             // 149: culture G — The Art Newspaper (institutional, stress)
      fetchVariety(),                  // 150: culture H — Variety entertainment industry (institutional, stress)
      fetchHypebeast(),                // 151: culture I — Hypebeast cultural trends (asymmetric — activity only)
      fetchPitchfork(),                // 152: culture J — Pitchfork music culture (asymmetric — activity only)
      fetchUNFPA(),                    // 153: population C — UNFPA population/reproductive health (institutional, stress)
      fetchCDCNCHS(),                  // 154: population D — CDC NCHS vital statistics (institutional, stress)
      fetchWHOGHO(),                   // 155: population E — WHO Global Health Observatory (institutional, stress)
      fetchUNHCRDisplacement(),        // 156: population F — UNHCR forced displacement (institutional, stress)
      fetchIOMmigration(),             // 157: population G — IOM migration tracking (institutional, stress)
      fetchIHMEPopHealth(),            // 158: population H — IHME population health metrics (institutional, stress)
      fetchGuttmacherInstitute(),      // 159: population I — Guttmacher reproductive health (institutional, stress)
      fetchCensusBureau(),             // 160: population J — US Census Bureau population (institutional, stress)
      fetchOurWorldInDataPop(),        // 161: population K — Our World in Data population (institutional, activity)
      fetchPopulationMatters(),         // 162: population L — Population Matters advocacy (asymmetric — activity only)
      fetchVaticanNews(),              // 163: religion C — Vatican News / Catholic (institutional, stress)
      fetchAlJazeeraReligion(),        // 164: religion D — Al Jazeera Islam/religion coverage (institutional, stress)
      fetchChristianityToday(),        // 165: religion E — Christianity Today evangelical (institutional, stress)
      fetchReligionNewsService(),      // 166: religion F — Religion News Service ecumenical (institutional, stress)
      fetchUSCIRF(),                   // 167: religion G — USCIRF international religious freedom (institutional, stress)
      fetchPewReligion(),              // 168: religion H — Pew Research Center religion (institutional, stress)
      fetchTimesOfIsraelReligion(),    // 169: religion I — Times of Israel religion/Judaism (institutional, stress)
      fetchHindustanTimesReligion(),   // 170: religion J — Hindustan Times religion/Hindu (institutional, stress)
      fetchBuddhistDoorGlobal(),       // 171: religion K — BuddhistDoor Global (institutional, activity)
      fetchSikhNetNews(),              // 172: religion L — SikhNet Sikh news (institutional, activity)
      fetchMormonNewsroom(),           // 173: religion M — LDS Church Newsroom / Mormon (institutional, stress)
      fetchJWNews(),                   // 174: religion N — JW.org / Jehovah's Witnesses (institutional, activity)
      fetchOrthodoxChristianity(),     // 175: religion O — Orthodox Christianity news (institutional, stress)
      fetchIslamicFinanceNews(),       // 176: religion P — Islamic finance / halal economy (institutional, stress)
      fetchJewishTelegraphicAgency(),  // 177: religion Q — JTA Jewish news (institutional, stress)
      fetchCatholicNewsAgency(),       // 178: religion R — Catholic News Agency (institutional, stress)
      fetchEsotericSpirituality(),     // 179: religion S — Esoteric / New Age / consciousness (asymmetric, activity)
      fetchMindfulnessIndustry(),      // 180: religion T — Mindfulness / meditation industry (asymmetric, activity)
      fetchSECEDGARCurrent(),          // 181: finance D — SEC EDGAR current filings (institutional, activity)
      fetchTreasuryYieldCurve(),       // 182: finance E — Treasury 10Y-2Y yield curve (institutional, stress)
      fetchTreasuryDebt(),             // 183: finance F — Treasury debt to the penny (institutional, stress)
      fetchFedH41(),                   // 184: finance G — Fed H.4.1 balance sheet RSS (institutional, activity)
      fetchFDICBankFailures(),         // 185: finance H — FDIC press / bank failures (institutional, stress)
      fetchOCCEnforcement(),           // 186: finance I — OCC news / bank regulatory action (institutional, stress)
      fetchCFTCPress(),                // 187: finance J — CFTC press releases (institutional, stress)
      fetchFINRADisciplinary(),        // 188: finance K — FINRA disciplinary actions (institutional, stress)
      fetchNYFedSOFR(),                // 189: finance L — NY Fed SOFR overnight rate (institutional, stress)
      fetchNCUACreditUnion(),          // 190: finance M — NCUA credit union news (institutional, stress)
      fetchNOAANWSAlerts(),            // 191: supplyChain C — NWS active hazard alerts (institutional, stress)
      fetchUSGSEarthquakes(),          // 192: supplyChain D — USGS M4.5+ earthquakes 24h (institutional, stress)
      fetchCISAKEV(),                  // 193: supplyChain E — CISA Known Exploited Vulns (institutional, stress)
      fetchFedRegCBP(),                // 194: supplyChain F — Fed Reg CBP (customs notices)
      fetchFedRegCoastGuard(),         // 195: supplyChain G — Fed Reg Coast Guard (port / marine)
      fetchFedRegFAA(),                // 196: supplyChain H — Fed Reg FAA (airspace regs)
      fetchFedRegNHTSA(),              // 197: supplyChain I — Fed Reg NHTSA (vehicle recalls)
      fetchFedRegFMCSA(),              // 198: supplyChain J — Fed Reg FMCSA (motor carrier)
      fetchFedRegUSTR(),               // 199: supplyChain K — Fed Reg USTR (tariffs / trade)
      fetchOFACRecentActions(),        // 200: supplyChain L — OFAC recent actions (sanctions)
      fetchUSDADroughtMonitor(),       // 201: agriculture D — USDA Drought Monitor (institutional, stress)
      fetchNOAACPCDrought(),           // 202: agriculture E — NOAA CPC drought outlook (institutional, stress)
      fetchNOAANWSAgAlerts(),          // 203: agriculture F — NWS active alerts (ag-filtered) (institutional, stress)
      fetchFDARecalls(),               // 204: agriculture G — FDA Recalls RSS (institutional, stress)
      fetchFedRegUSDA(),               // 205: agriculture H — Fed Reg USDA (regulatory)
      fetchFedRegFDA(),                // 206: agriculture I — Fed Reg FDA (food safety regulatory)
      fetchFedRegEPA(),                // 207: agriculture J — Fed Reg EPA (pesticide / water)
      fetchFedRegAPHIS(),              // 208: agriculture K — Fed Reg APHIS (pest / disease)
      fetchFedRegFSIS(),               // 209: agriculture L — Fed Reg FSIS (meat/poultry safety)
      fetchWorldBankFoodIndex(),       // 210: agriculture M — World Bank food production index
      fetchTreasuryMTS(),              // 211: economy F — Treasury Monthly Statement (institutional, stress)
      fetchTreasuryOperatingCash(),    // 212: economy G — Treasury Operating Cash Balance (institutional, stress)
      fetchTreasuryDebtOutstanding(),  // 213: economy H — Treasury Debt Outstanding (institutional, stress)
      fetchFedMonetaryPress(),         // 214: economy I — Fed monetary press releases (institutional, stress)
      fetchFedRegFedReserve(),         // 215: economy J — Fed Reg Federal Reserve System (regulatory)
      fetchFedRegTreasury(),           // 216: economy K — Fed Reg Treasury (regulatory)
      fetchFedRegIRS(),                // 217: economy L — Fed Reg IRS (tax/fiscal)
      fetchNYFedEFFR(),                // 218: economy M — NY Fed EFFR (institutional, stress)
      fetchWorldBankGDPGrowth(),       // 219: economy N — World Bank GDP growth USA
      fetchWorldBankInflation(),       // 220: economy O — World Bank CPI inflation USA
      fetchFedRegOSHA(),               // 221: industry H — Fed Reg OSHA (workplace safety regs)
      fetchFedRegMSHA(),               // 222: industry I — Fed Reg MSHA (mine safety regs)
      fetchFedRegBIS(),                // 223: industry J — Fed Reg BIS (export controls / input shortage)
      fetchFedRegDOL(),                // 224: industry K — Fed Reg DOL (labor / workforce regs)
      fetchFedRegFERC(),               // 225: infrastructure F — Fed Reg FERC (grid regulatory)
      fetchFedRegDHS(),                // 226: infrastructure G — Fed Reg DHS (security regulatory)
      fetchFedRegDOT(),                // 227: infrastructure H — Fed Reg DOT (transportation regulatory)
      fetchFedRegHUD(),                // 228: infrastructure I — Fed Reg HUD (housing/urban regulatory)
      fetchCISAAdvisories(),           // 229: infrastructure J — CISA cybersecurity advisories
      fetchFedRegArmyCorps(),          // 230: infrastructure K — Fed Reg Army Corps (civil works)
      fetchFedRegDOE(),                // 231: energy Q — Fed Reg DOE (Department of Energy)
      fetchFedRegNRC(),                // 232: energy R — Fed Reg NRC (Nuclear Regulatory Commission)
      fetchFedRegDoD(),                // 233: defense H — Fed Reg DoD (Department of Defense)
      fetchFedRegStateDept(),          // 234: defense I — Fed Reg State (State Department)
      fetchFedRegFBI(),                // 235: intelligence F — Fed Reg FBI
      fetchFedRegCIA(),                // 236: intelligence G — Fed Reg CIA
      fetchFedRegNSA(),                // 237: intelligence H — Fed Reg NSA
      fetchFedRegEOP(),                // 238: governance E — Fed Reg EOP (Executive Office of the President)
      fetchFedRegInterior(),           // 239: environment F — Fed Reg Interior (Department of the Interior)
      fetchFedRegHHS(),                // 240: medicine G — Fed Reg HHS (Health and Human Services)
      fetchFedRegCDC(),                // 241: medicine H — Fed Reg CDC
      fetchFedRegCMS(),                // 242: medicine I — Fed Reg CMS (Medicare/Medicaid)
      fetchFedRegNIH(),                // 243: medicine J — Fed Reg NIH (National Institutes of Health)
      fetchFedRegNSF(),                // 244: research G — Fed Reg NSF (National Science Foundation)
      fetchFedRegEducation(),          // 245: research H — Fed Reg Education
      fetchFedRegNASA(),               // 246: research I — Fed Reg NASA
      fetchFedRegSmithsonian(),        // 247: research J — Fed Reg Smithsonian
      fetchWorldBankRD(),              // 248: research K — World Bank R&D % GDP
      fetchFedRegFCC(),                // 249: technology H — Fed Reg FCC (telecom/platform)
      fetchFedRegNIST(),               // 250: technology I — Fed Reg NIST (AI/standards)
      fetchFedRegFTC(),                // 251: technology J — Fed Reg FTC (antitrust/platform)
      fetchWorldBankTertiary(),        // 252: education F — World Bank tertiary enrollment
      fetchWorldBankFertility(),       // 253: population M — World Bank Total Fertility Rate
      fetchFedRegCensus(),             // 254: population N — Fed Reg Census Bureau
      fetchFedRegSSA(),                // 255: population O — Fed Reg Social Security Administration
      fetchFedRegDOJ(),                // 256: law F — Fed Reg DOJ (Department of Justice)
      fetchFedRegDEA(),                // 257: law G — Fed Reg DEA (Drug Enforcement Administration)
      fetchFedRegBOP(),                // 258: law H — Fed Reg Bureau of Prisons
      fetchFedRegPTO(),                // 259: research replacement — Fed Reg Patent & Trademark Office (replaces key-gated USPTO)
      fetchBBCWorldNews(),             // 260: communication replacement — BBC World News (replaces key-gated NewsAPI)
      fetchWBGovEffectiveness(),       // 261: governance — WB Government Effectiveness (GE.EST)
      fetchWBRuleOfLaw(),              // 262: governance — WB Rule of Law (RL.EST)
      fetchWBInternetUsers(),          // 263: communication — WB Internet Users % (IT.NET.USER.ZS)
      fetchWBLogisticsLPI(),           // 264: supplyChain — WB Logistics Performance Index (LP.LPI.OVRL.XQ)
      fetchWBManufacturing(),          // 265: industry — WB Manufacturing %GDP (NV.MNF.TOTL.ZS)
      fetchSpotifyCharts(),            // 266: culture K — streaming/virality pulse (Spotify charts signal, activity)
      fetchBillboardCharts(),          // 267: culture L — Billboard Hot 100 chart movement signal (activity)
      fetchGeniusCommentary(),         // 268: culture M — Genius lyrics/commentary taste-making signal (activity)
      fetchSongkickTours(),            // 269: culture N — Songkick live performance / touring signal (activity)
      fetchSoundcloudEmerging(),       // 270: culture O — SoundCloud emerging-artist signal (activity)
      fetchMusicSceneDiscourse()       // 271: culture P — music scene / genre discourse + movements (stress)
    ]);

    // Fetch GDELT sources in parallel with fast timeout (2s)
    // GDELT is unreliable — use cache when available, fail fast otherwise
    var GDELT_FAST_TIMEOUT = 2000;
    var gdeltFns = [
      { fn: fetchGDELTGovernance, idx: 'gdelt_governance' },
      { fn: fetchGDELTMedia,      idx: 'gdelt_media' },
      { fn: fetchGDELTTone,       idx: 'gdelt_tone' },
      { fn: fetchGDELTConflict,   idx: 'gdelt_conflict' },
      { fn: fetchGDELTReligion,   idx: 'gdelt_religion' },
      { fn: fetchGDELTIntel,      idx: 'gdelt_intel' }
    ];
    var gdeltPromises = gdeltFns.map(function(g) {
      var cached = _gdeltCacheGet(g.idx);
      if (cached !== null) return Promise.resolve(cached);
      return Promise.race([
        g.fn().then(function(r) { if (r) _gdeltCacheSet(g.idx, r); return r; }),
        sleep(GDELT_FAST_TIMEOUT).then(function() { return null; })
      ]).catch(function() { return null; });
    });
    var gdeltRaw = await Promise.allSettled(gdeltPromises);
    var gdeltResults = gdeltRaw.map(function(r) {
      return { status: 'fulfilled', value: r.status === 'fulfilled' ? r.value : null };
    });

    // Build name-keyed result map. Each fetcher's resolved value is bound to
    // its SOURCE_KEYS entry (and ONLY to that entry). No second reassembly,
    // no integer remap — what the fetcher returned is what byKey() returns.
    var srcMap = Object.create(null);
    for (var __i = 0; __i < SOURCE_KEYS.length; __i++) {
      var __r = nonGdeltResults[__i];
      if (__r && __r.status === 'fulfilled') {
        srcMap[SOURCE_KEYS[__i]] = __r.value;
      } else {
        var __reason = __r && __r.reason ? (__r.reason.message || String(__r.reason)) : 'unknown';
        console.warn('[domain-snapshot] ' + SOURCE_KEYS[__i] + ' rejected: ' + __reason);
        srcMap[SOURCE_KEYS[__i]] = null;
      }
    }
    // GDELT cluster — name-keyed alongside.
    for (var __gi = 0; __gi < gdeltFns.length; __gi++) {
      var __gr = gdeltResults[__gi];
      var __gkey = 'gdelt_' + gdeltFns[__gi].idx.replace(/^gdelt_/, '');
      srcMap[__gkey] = __gr && __gr.status === 'fulfilled' ? __gr.value : null;
    }

    var byKey = function (key) {
      if (!(key in srcMap)) {
        console.warn('[domain-snapshot] missing source key: ' + key);
        return null;
      }
      return srcMap[key];
    };

    var now = Date.now();

    // ── Phase 23C: Read ingest cluster data for severity-based defense scoring ──
    var clusterBoosts = {};
    try {
      var ingestData = await db.get('latest_ingest');
      // TTL check: reject ingest data older than 2 hours
      var INGEST_TTL = 2 * 60 * 60 * 1000;
      var ingestAge = ingestData && ingestData.timestamp ? (Date.now() - ingestData.timestamp) : Infinity;
      var ingestFresh = ingestAge < INGEST_TTL;
      if (!ingestFresh && ingestData) {
        console.warn('[domain-snapshot] Stale ingest data (age: ' + Math.round(ingestAge / 60000) + 'm) — cluster boost suppressed');
      }
      if (ingestFresh && ingestData && ingestData.signals && ingestData.signals.length > 0) {
        // Build per-domain cluster severity from classified event families
        var domainClusterMap = {}; // domain -> { totalSeverity, clusterCount, topEvent, topMag }
        for (var csi = 0; csi < ingestData.signals.length; csi++) {
          var sig = ingestData.signals[csi];
          if (sig.confidence === 'LOW') continue; // skip weak signals
          var severity = sig.magnitude * sig.confidenceValue * Math.min(sig.articleCount / 5, 1);
          for (var cdi = 0; cdi < sig.affectedDomains.length; cdi++) {
            var cdom = sig.affectedDomains[cdi];
            if (!domainClusterMap[cdom]) domainClusterMap[cdom] = { totalSeverity: 0, clusterCount: 0, topEvent: '', topMag: 0 };
            domainClusterMap[cdom].totalSeverity += severity;
            domainClusterMap[cdom].clusterCount++;
            if (sig.magnitude > domainClusterMap[cdom].topMag) {
              domainClusterMap[cdom].topMag = sig.magnitude;
              domainClusterMap[cdom].topEvent = sig.eventType;
            }
          }
        }
        // Convert to cluster boosts (capped at 0.95)
        for (var cbk in domainClusterMap) {
          var cm = domainClusterMap[cbk];
          var clusterStress = clamp(cm.totalSeverity / cm.clusterCount, 0.1, 0.95);
          // Spread bonus: more clusters = more corroboration
          if (cm.clusterCount >= 3) clusterStress = Math.min(0.95, clusterStress * 1.15);
          clusterBoosts[cbk] = {
            clusterStress: round(clusterStress),
            clusterCount: cm.clusterCount,
            topEvent: cm.topEvent,
            signal: cm.clusterCount + ' event clusters (' + cm.topEvent.replace(/_/g, ' ').toLowerCase() + ')'
          };
        }
      }
    } catch (e) { /* ingest data unavailable — no cluster boost */ }

    // Merge NOAA Alerts LIMEN disturbance signal into environment domain
    // Institutional sources (NOAA, EPA, USGS, Global Forest Watch, IUCN) can independently raise
    // environment stress. Advocacy / asymmetric sources (Inside Climate News, Grist) are
    // directional activity-only signals that cannot independently fire high-stress diagnoses.
    var envDomain = buildDomain('environment', [
      // 10 feeds, diversified across 4 collection methodologies. All keyless.
      // Dropped from prior set: NOAA Research (v111) redundant with NOAA Climate;
      // Grist Environment (v116) most generic news/keyword.
      src('NOAA Climate', byKey('NOAAClimate')),    // 1: NOAA institutional API (temperature anomaly)
      src('NOAA Alerts', byKey('NOAAAlerts')),    // 2: NOAA institutional API (active alerts/disturbance)
      src('EPA News', byKey('EPANews')),  // 3: EPA RSS keyword (regulatory news)
      src('USGS News', byKey('USGSNews')),  // 4: USGS RSS (geological events)
      src('Global Forest Watch', byKey('GlobalForestWatchNews')),  // 5: forest-loss RSS
      src('IUCN Red List', byKey('IUCNNews')),  // 6: biodiversity RSS
      src('Inside Climate News', byKey('InsideClimateNews')),  // 7: climate journalism RSS
      src('USGS Earthquakes', byKey('USGSEarthquakes')),  // 8: USGS GeoJSON API (reused — different from RSS)
      src('Fed Reg EPA', byKey('FedRegEPA')),  // 9: Federal Register EPA (reused from agriculture)
      src('Fed Reg Interior', byKey('FedRegInterior'))   // 10: Federal Register / Department of Interior
    ]);
    var alertData = byKey('NOAAAlerts');
    if (alertData) {
      envDomain.activeAlerts = alertData.activeAlerts || 0;
      envDomain.disturbanceCount = alertData.disturbanceCount || 0;
      envDomain.disturbanceIntensity = alertData.disturbanceIntensity || 0;
      envDomain.disturbanceNovelty = alertData.disturbanceNovelty || 0;
      envDomain.disturbancePersistence = alertData.disturbancePersistence || 0;
    }

    // Merge USPTO patent signals into technology domain
    var techDomain = buildDomain('technology', [
      // 10 feeds, diversified across 5 collection methodologies.
      // Existing technology feeds (7 — 1 key-gated USPTO + 6 keyless)
      src('USPTO Patents', byKey('Patents')),    // 1: USPTO API (KEY-GATED — needs USPTO_API_KEY)
      src('arXiv CS', byKey('ArXivCS')),    // 2: arXiv CS preprints (keyless API)
      src('CISA KEV', byKey('CISAKEV')),   // 3: CISA Known Exploited Vulnerabilities
      src('NVD Recent CVEs', byKey('NVDRecent')),   // 4: NIST NVD CVE feed
      src('Krebs Security', byKey('KrebsSecurity')),   // 5: Krebs RSS
      src('Hacker News', byKey('HackerNews')),   // 6: Hacker News community RSS
      src('GitHub Security Advisories', byKey('GitHubSecurityAdvisories')),   // 7: GitHub Security Advisories RSS
      // Federal Register doc-counts (3 — institutional regulatory)
      src('Fed Reg FCC', byKey('FedRegFCC')),  // 8: telecom/platform regulatory
      src('Fed Reg NIST', byKey('FedRegNIST')),  // 9: standards/AI regulatory
      src('Fed Reg FTC', byKey('FedRegFTC'))   // 10: antitrust/platform regulatory
    ]);
    var patentData = byKey('Patents');
    if (patentData && patentData.patentSignals) {
      techDomain.patentSignals = patentData.patentSignals;
    }

    var domains = {
      economy:     buildDomain('economy',     [
        src('FRED CPI', byKey('FRED')),
        src('BLS Employment', byKey('BLS')),
        src('FRED Gas Price', byKey('FREDGasPrice')),
        src('FRED Food CPI', byKey('FREDFoodCPI')),
        src('FRED Consumer Sentiment', byKey('FREDConsumerSentiment')),
        src('Treasury MTS', byKey('TreasuryMTS')),
        src('Treasury Cash Balance', byKey('TreasuryOperatingCash')),
        src('Treasury Debt Outstanding', byKey('TreasuryDebtOutstanding')),
        src('Fed Monetary Press', byKey('FedMonetaryPress')),
        src('Fed Reg Fed Reserve', byKey('FedRegFedReserve')),
        src('Fed Reg Treasury', byKey('FedRegTreasury')),
        src('Fed Reg IRS', byKey('FedRegIRS')),
        src('NY Fed EFFR', byKey('NYFedEFFR')),
        src('World Bank GDP Growth', byKey('WorldBankGDPGrowth')),
        src('World Bank Inflation', byKey('WorldBankInflation'))
      ]),
      energy:      buildDomain('energy',      [
        // Real crude price feeds first when live; institutional/RSS feeds below
        // remain stress context. D2-E2 in EnergyBrain guards crude-price ingestion
        // so only legitimate price feeds can produce $/bbl conditions.
        // OPEC Reference Basket below remains RSS/stress unless backed by a true price fetcher.
        src('Massive Crude Oil', byKey('MassiveCrudeOil')),  // price: real-time crude
        src('FRED Crude Oil', byKey('FREDEnergy')),  // price: WTI structural
        src('EIA Petroleum', byKey('EIA')),  // price: Brent structural
        src('Grid Reliability (FERC/NERC)', byKey('GridReliabilityNews')),  // 1: GRID_COLLAPSE primary
        src('EIA Natural Gas Weekly', byKey('EIANaturalGas')),  // 2: heating + electricity + fertilizer
        src('EIA Weekly Petroleum Status', byKey('EIAWeeklyPetroleum')),  // 3: oil supply / refinery
        src('OPEC Reference Basket', byKey('OPECBasket')),  // 4: OIL_SHOCK primary
        src('Nuclear Energy News', byKey('NuclearEnergyNews')),  // 5: NUCLEAR_INCIDENT
        src('EIA Electricity Monthly', byKey('EIAElectricity')),  // 6: generation mix
        src('NOAA NWS Alerts', byKey('NOAANWSAlerts')),  // 7: weather → grid stress (reused)
        src('CISA KEV', byKey('CISAKEV_2')),  // 8: cyber → grid threat (reused)
        src('Fed Reg NRC', byKey('FedRegNRC')),  // 9: nuclear regulatory
        src('Fed Reg DOE', byKey('FedRegDOE')),  // 10: DOE regulatory
        src('LNG Market News', byKey('LNGMarketNews')),  // 11: gas trade / pipeline
        src('IEA Energy News', byKey('IEANews')),  // 12: institutional broad
        src('Solar Industry News', byKey('SolarIndustryNews')),  // 13: renewable
        src('Wind Energy News', byKey('WindEnergyNews')),  // 14: renewable
        src('Coal Transition News', byKey('CoalTransitionNews'))   // 15: generation mix retirement
      ], { clusterBoost: clusterBoosts.energy }),
      environment: envDomain,
      health:      buildDomain('health',      [
        // 15 feeds, diversified across 5 collection methodologies. All keyless.
        // Research integration: PubMed + NIH Grants + Retraction Watch added because
        // medical signal is inseparable from biomedical literature / funding flows.
        // Existing health institutional feeds (6)
        src('openFDA Events', byKey('FDAEvents')),    // 1: openFDA adverse events API
        src('openFDA Recalls', byKey('FDARecalls')),    // 2: openFDA recalls API
        src('CDC MMWR', byKey('CDCMMWR')),   // 3: CDC Morbidity and Mortality Weekly Report
        src('WHO Disease Outbreak', byKey('WHODiseaseOutbreak')),   // 4: WHO disease outbreak news
        src('FDA Drug Shortages', byKey('FDADrugShortages')),   // 5: FDA drug shortages
        src('ClinicalTrials.gov', byKey('ClinicalTrials')),   // 6: ClinicalTrials.gov API
        // Research-domain feeds reused (3 — biomedical literature/funding/integrity)
        src('PubMed', byKey('PubMed')),   // 7: PubMed biomedical literature (reused)
        src('NIH Grants', byKey('NIHGrants')),   // 8: NIH Grants research funding (reused)
        src('Retraction Watch', byKey('RetractionWatch')),   // 9: research integrity (reused)
        // FDA Recalls RSS XML — distinct from openFDA API (1)
        src('FDA Recalls', byKey('FDARecalls_2')),  // 10: FDA recalls RSS XML (reused from agriculture)
        // Federal Register doc-counts (5)
        src('Fed Reg HHS', byKey('FedRegHHS')),  // 11: HHS regulatory volume
        src('Fed Reg CDC', byKey('FedRegCDC')),  // 12: CDC regulatory volume
        src('Fed Reg CMS', byKey('FedRegCMS')),  // 13: CMS Medicare/Medicaid regulatory
        src('Fed Reg NIH', byKey('FedRegNIH')),  // 14: NIH regulatory volume
        src('Fed Reg FDA', byKey('FedRegFDA'))   // 15: FDA regulatory (reused from agriculture)
      ]),
      technology:  techDomain,
      research:    buildDomain('research',    [
        // 15 feeds, diversified across 5 collection methodologies. All keyless.
        // Existing research feeds (6)
        src('PubMed', byKey('PubMed')),  // 1: NCBI biomedical literature API
        src('arXiv All', byKey('ArXivAll')),  // 2: arXiv multi-discipline preprint API
        src('NSF Awards', byKey('NSFAwards')),  // 3: NSF funding RSS
        src('Retraction Watch', byKey('RetractionWatch')),  // 4: research integrity RSS
        src('NIH Grants', byKey('NIHGrants')),  // 5: NIH funding RSS
        src('Nature / Science Press', byKey('NatureScience')),  // 6: high-impact paradigm press RSS
        // Reused literature/output APIs (3)
        src('arXiv CS', byKey('ArXivCS')),   // 7: arXiv CS-focused (reused from technology)
        src('OpenAlex Institutions', byKey('OpenAlex')),  // 8: research institutions/scholars (reused from education)
        src('Fed Reg PTO', byKey('FedRegPTO')), // 9: Fed Reg / Patent & Trademark Office (keyless replacement for key-gated USPTO API)
        // Federal Register doc-counts (5)
        src('Fed Reg NSF', byKey('FedRegNSF')), // 10: National Science Foundation regulatory
        src('Fed Reg Education', byKey('FedRegEducation')), // 11: Education Dept R&D regulatory
        src('Fed Reg NASA', byKey('FedRegNASA')), // 12: NASA space science regulatory
        src('Fed Reg Smithsonian', byKey('FedRegSmithsonian')), // 13: Smithsonian regulatory
        src('Fed Reg DOE', byKey('FedRegDOE')), // 14: Dept of Energy science office (reused from energy)
        // World Bank R&D (1 — keyless WB JSON)
        src('World Bank R&D', byKey('WorldBankRD'))  // 15: R&D expenditure % GDP
      ]),
      supplyChain:    buildDomain('supplyChain',    [
        src('BLS Freight PPI', byKey('BLSFreight')),
        src('RSS Supply Chain', byKey('RSSSupplyChain')),
        src('World Bank Logistics Index', byKey('WBLogisticsLPI')), // WB LPI — supply-chain-specific real driver
        src('NOAA NWS Alerts', byKey('NOAANWSAlerts')),
        src('USGS Earthquakes', byKey('USGSEarthquakes')),
        src('CISA KEV', byKey('CISAKEV_2')),
        src('Fed Reg CBP', byKey('FedRegCBP')),
        src('Fed Reg Coast Guard', byKey('FedRegCoastGuard')),
        src('Fed Reg FAA', byKey('FedRegFAA')),
        src('Fed Reg NHTSA', byKey('FedRegNHTSA')),
        src('Fed Reg FMCSA', byKey('FedRegFMCSA')),
        src('Fed Reg USTR', byKey('FedRegUSTR')),
        src('OFAC Recent Actions', byKey('OFACRecentActions'))
      ], { clusterBoost: clusterBoosts.supplyChain }),
      governance:     buildDomain('governance',     [
        // 10 feeds, diversified across 4 collection methodologies. All keyless.
        // Dropped from prior set: RSS Governance (v15) generic-keyword redundant;
        // 7 partisan feeds (Mother Jones / HuffPost / The Nation / Breitbart /
        // Washington Times / National Review / Daily Caller) — labeled "positional
        // only" in brain, only fired trust_erosion, single shared noise floor.
        src('World Bank Governance', byKey('WorldBankGovernance')),   // 1: WB JSON API (institutional indicator)
        src('World Bank Gov Effectiveness', byKey('WBGovEffectiveness')),   // WB government effectiveness (real numeric driver)
        src('World Bank Rule of Law', byKey('WBRuleOfLaw')),   // WB rule of law (real numeric driver)
        src('GovTrack', byKey('GovTrack')),   // 2: direct govtrack.us RSS (legislative activity)
        src('Congress.gov', byKey('CongressGov')),   // 3: direct congress.gov RSS (institutional)
        src('GAO Reports', byKey('GAOReports')),   // 4: direct gao.gov RSS (oversight)
        src('CBO Publications', byKey('CBOPublications')),   // 5: direct cbo.gov RSS (fiscal projections)
        src('OMB Releases', byKey('OMBReleases')),  // 6: OMB executive budget RSS
        src('Brennan Center', byKey('BrennanCenter')),  // 7: civil liberties / election watchdog
        src('POGO', byKey('POGO')),  // 8: Project on Government Oversight watchdog
        src('Fed Reg EOP', byKey('FedRegEOP')),  // 9: Federal Register / Executive Office (doc-count)
        src('CISA KEV', byKey('CISAKEV_2'))   // 10: election/governance cyber integrity (reused)
      ], { clusterBoost: clusterBoosts.governance }),
      infrastructure: buildDomain('infrastructure', [
        // CIVIL infrastructure parity with energy: domain-specific structural
        // stress drivers FIRST (asset condition / operational metrics / funding),
        // then cross-domain pressure + workforce + regulatory context. Mirrors
        // energy's 15-feed structure (operational + reliability + regulatory +
        // workforce + cross-domain) translated to roads / bridges / water-sewer
        // mains / the electric GRID / transit / dams-levees / cyber-physical /
        // construction & public works / deferred maintenance / capital funding.
        // ── ASSET CONDITION & OPERATIONAL METRICS (domain-specific stress) ──
        src('FRED Construction Spending', byKey('FREDConstructionSpending')),  // 1: public-works / construction output + materials proxy (cement/steel-driven), ASSET_BUILD stress
        src('FRED Transportation Index', byKey('FREDTransportationIndex')),    // 2: freight / transit reliability operational metric (parallels EIA Electricity ops)
        src('PHMSA Incidents', byKey('PHMSAIncidents')),                       // 3: pipeline / water-sewer main leaks + rail derailments = real-time ASSET_FAILURE (parallels FERC/NERC grid outages)
        src('FRED Federal Investment', byKey('FREDFederalInvestment')),        // 4: federal capital funding / BIL-IIJA disbursement proxy (FUNDING stress)
        // ── OPERATIONAL / TRANSPORT RELIABILITY CONTEXT ──
        src('World Bank Logistics Index', byKey('WBLogisticsLPI')),  // 5: transport / materials-movement reliability (transit + supply-chain cascade)
        src('World Bank Infrastructure', byKey('WorldBankInfra')),   // 6: structural infrastructure index (context)
        // ── CROSS-DOMAIN PRESSURE / CASCADE (asset-stress cluster, reused) ──
        // clusterBoost (below) is the in-file analog of energy's cross-domain
        // pressure / asset-condition internal feed: ingest cluster severity is
        // routed to the infrastructure domain to detect multi-modal breakdown
        // (grid outage → transit signaling, water main failure → public-health).
        src('NOAA NWS Alerts', byKey('NOAANWSAlerts')),  // 7: weather → road / transit / grid stress (reused)
        src('USGS Earthquakes', byKey('USGSEarthquakes')),  // 8: seismic → bridge / dam / pipeline stress (reused)
        src('CISA KEV', byKey('CISAKEV_2')),  // 9: cyber-physical → SCADA / ICS grid + water threat (reused)
        src('CISA Advisories', byKey('CISAAdvisories')),  // 10: ICS / control-system advisories (reused)
        // ── WORKFORCE / LABOR AVAILABILITY (construction + maintenance) ──
        src('UAW Strike Tracker', byKey('UAWStrikeTracker')),  // 11: construction / trades work stoppages + labor walkouts (reused from industry)
        src('Fed Reg OSHA', byKey('FedRegOSHA')),  // 12: construction / maintenance worker safety regulatory (reused)
        src('Fed Reg DOL', byKey('FedRegDOL')),    // 13: labor / apprenticeship / workforce regulatory (reused)
        // ── REGULATORY ENTRY-POINTS (funding + mode authorities) ──
        src('Fed Reg FERC', byKey('FedRegFERC')),  // 14: grid transmission/distribution regulatory
        src('Fed Reg DHS', byKey('FedRegDHS')),    // 15: critical-infrastructure security regulatory
        src('Fed Reg DOT', byKey('FedRegDOT')),    // 16: roads / transit / rail / air mode regulatory
        src('Fed Reg HUD', byKey('FedRegHUD')),    // 17: housing / urban capital programs regulatory
        src('Fed Reg Army Corps', byKey('FedRegArmyCorps'))  // 18: dams / levees / civil-works regulatory + USACE funding
      ], { clusterBoost: clusterBoosts.infrastructure }),
      agriculture:    buildDomain('agriculture',    [
        src('USDA NASS', byKey('USDA')),
        src('RSS Agriculture', byKey('RSSAgriculture')),
        src('FAO FAOSTAT', byKey('FAO')),
        src('USDA Drought Monitor', byKey('USDADroughtMonitor')),
        src('NOAA CPC Drought', byKey('NOAACPCDrought')),
        src('NOAA NWS Ag Alerts', byKey('NOAANWSAgAlerts')),
        src('FDA Recalls', byKey('FDARecalls_2')),
        src('Fed Reg USDA', byKey('FedRegUSDA')),
        src('Fed Reg FDA', byKey('FedRegFDA')),
        src('Fed Reg EPA', byKey('FedRegEPA')),
        src('Fed Reg APHIS', byKey('FedRegAPHIS')),
        src('Fed Reg FSIS', byKey('FedRegFSIS')),
        src('World Bank Food Index', byKey('WorldBankFoodIndex'))
      ]),
      industry:       buildDomain('industry',       [
        src('BLS Manufacturing PPI', byKey('BLSManufacturing')),
        src('NHTSA Recalls', byKey('NHTSARecalls')),
        src('World Bank Manufacturing', byKey('WBManufacturing')), // WB manufacturing %GDP (real numeric driver)
        src('CPSC Recalls', byKey('CPSCRecalls')),
        src('PHMSA Incidents', byKey('PHMSAIncidents')),
        src('CSB Investigations', byKey('CSBInvestigations')),
        src('UAW Strike Tracker', byKey('UAWStrikeTracker')),
        src('Fed Reg OSHA', byKey('FedRegOSHA')),
        src('Fed Reg MSHA', byKey('FedRegMSHA')),
        src('Fed Reg BIS', byKey('FedRegBIS')),
        src('Fed Reg DOL', byKey('FedRegDOL'))
      ]),
      education:      buildDomain('education',      [
        // 10 feeds, diversified across 5 collection methodologies. All keyless.
        // Existing education feeds (7)
        src('World Bank Education', byKey('WorldBankEducation')),  // 1: WB education spending % GDP (JSON API)
        src('OpenAlex Institutions', byKey('OpenAlex')),  // 2: OpenAlex scholar metadata API
        src('ED.gov News', byKey('EDGovNews')),  // 3: U.S. Dept of Education RSS
        src('NCES News', byKey('NCESNews')),  // 4: National Center for Education Statistics
        src('EdWeek News', byKey('EdWeekNews')),  // 5: Education Week journalism
        src('IES News', byKey('IESNews')),  // 6: Institute of Education Sciences
        src('Chronicle of Higher Ed', byKey('ChronicleHigherEd')),  // 7: Chronicle of Higher Education
        // Federal Register doc-counts (2 — reused, distinct cadence)
        src('Fed Reg Education', byKey('FedRegEducation')), // 8: Education Dept regulatory (reused from research)
        src('Fed Reg NSF', byKey('FedRegNSF')), // 9: NSF (university research funding) (reused from research)
        // World Bank tertiary enrollment (1 — keyless, real institutional indicator)
        src('World Bank Tertiary', byKey('WorldBankTertiary'))  // 10: tertiary enrollment % gross
      ]),
      communication:  buildDomain('communication',  [
        // 10 feeds, all keyless after cleanup (NewsAPI key-gated slot replaced
        // with BBC World News direct RSS).
        src('BBC World News', byKey('BBCWorldNews')), // 1: BBC World News (keyless replacement for NewsAPI)
        src('World Bank Internet Users', byKey('WBInternetUsers')), // WB internet penetration (real numeric driver)
        src('RSS Media', byKey('RSSMedia')),  // 2: RSS keyword
        src('Reporters Without Borders', byKey('RSF')),  // 3: press freedom watchdog RSS
        src('CPJ Press Freedom', byKey('CPJ')),  // 4: Committee to Protect Journalists RSS
        src('Snopes Fact Checks', byKey('Snopes')),  // 5: fact-check RSS
        src('Poynter Media News', byKey('Poynter')),  // 6: media journalism RSS
        src('Nieman Lab', byKey('NiemanLab')),  // 7: media research RSS
        src('Fed Reg FCC', byKey('FedRegFCC')), // 8: telecom regulatory (reused from technology)
        src('Fed Reg FTC', byKey('FedRegFTC')), // 9: media antitrust regulatory (reused from technology)
        src('CISA Advisories', byKey('CISAAdvisories'))  // 10: cyber/network advisories (reused from infrastructure)
      ]),
      culture:        buildDomain('culture',        [
        src('Event Registry', byKey('EventRegistryCulture')),
        src('RSS Culture', byKey('RSSCulture')),
        src('NEA News', byKey('NEANews')),
        src('NEH News', byKey('NEHNews')),
        src('UNESCO Culture', byKey('UNESCOCulture')),
        src('PEN America', byKey('PENAmerica')),
        src('Art Newspaper', byKey('ArtNewspaper')),
        src('Variety Entertainment', byKey('Variety')),
        src('Hypebeast Trends', byKey('Hypebeast')),
        src('Pitchfork Music', byKey('Pitchfork')),
        src('Spotify Streaming Charts', byKey('SpotifyCharts')),
        src('Billboard Charts', byKey('BillboardCharts')),
        src('Genius Commentary', byKey('GeniusCommentary')),
        src('Songkick Tours', byKey('SongkickTours')),
        src('SoundCloud Emerging', byKey('SoundcloudEmerging')),
        src('Music Scene Discourse', byKey('MusicSceneDiscourse'))
      ]),
      defense:        buildDomain('defense',        [
        // 15 feeds, diversified across 6 collection methodologies to avoid
        // single-noise-floor fire-everything pattern.
        // RSS news (7): institutional analysts + alliance + adversary perspectives
        src('Defense News', byKey('DefenseNews')),   // 1: US defense industry trade press
        src('Breaking Defense', byKey('BreakingDefense')),   // 2: DoD acquisitions / operations
        src('ISW Daily Updates', byKey('ISW')),   // 3: Institute for the Study of War
        src('NATO News', byKey('NATONews')),   // 4: alliance official
        src('SIPRI Arms Trade', byKey('SIPRI')),   // 5: international arms transfer data
        src('TASS (Russia)', byKey('TASS')),   // 6: Russian state — counter-narrative
        src('Xinhua (China)', byKey('Xinhua')),   // 7: Chinese state — Pacific tensions
        // Federal Register doc-count (3 — distinct daily-cadence regulatory channel)
        src('Fed Reg DoD', byKey('FedRegDoD')),  // 8: DoD regulatory volume
        src('Fed Reg State', byKey('FedRegStateDept')),  // 9: diplomatic / sanctions regulatory
        src('Fed Reg DHS', byKey('FedRegDHS')),  // 10: homeland security (reused)
        // CISA security data APIs (2 — curated CVE / advisory feeds)
        src('CISA KEV', byKey('CISAKEV_2')),  // 11: known-exploited CVEs (reused)
        src('CISA Advisories', byKey('CISAAdvisories')),  // 12: cybersecurity advisories (reused)
        // Geo event APIs (2 — natural disasters / staging)
        src('NOAA NWS Alerts', byKey('NOAANWSAlerts')),  // 13: weather/civil-staging (reused)
        src('USGS Earthquakes', byKey('USGSEarthquakes')),  // 14: seismic events / mobilization (reused)
        // Sanctions HTML (1 — proliferation / arms-trade signal)
        src('OFAC Recent Actions', byKey('OFACRecentActions'))   // 15: sanctions designations (reused)
      ], { clusterBoost: clusterBoosts.defense }),
      religion:       buildDomain('religion',       [
        // 15 feeds covering distinct major traditions. All keyless RSS.
        // Dropped from prior set: LDS Mormon (v173), JW.org (v174),
        // Islamic Finance (v176), Catholic News Agency (v178), Mindfulness (v180)
        // — niche denominations or redundant with other Christian/Islam feeds.
        src('RSS Religion Events', byKey('RSSReligionEvents')),   // 1: broad event tracker
        src('RSS Religion News', byKey('RSSReligion')),   // 2: broad news
        src('Vatican News', byKey('VaticanNews')),  // 3: Catholicism (authoritative)
        src('Al Jazeera Religion', byKey('AlJazeeraReligion')),  // 4: Islam (broad / global)
        src('Christianity Today', byKey('ChristianityToday')),  // 5: Evangelical Christianity
        src('Religion News Service', byKey('ReligionNewsService')),  // 6: Interfaith / American mainline
        src('USCIRF', byKey('USCIRF')),  // 7: Religious freedom watchdog
        src('Pew Religion', byKey('PewReligion')),  // 8: Research / SECULARIZATION
        src('Times of Israel Religion', byKey('TimesOfIsraelReligion')),  // 9: Israeli Judaism
        src('Hindustan Times Religion', byKey('HindustanTimesReligion')),  // 10: Hinduism / India
        src('BuddhistDoor Global', byKey('BuddhistDoorGlobal')),  // 11: Buddhism
        src('SikhNet News', byKey('SikhNetNews')),  // 12: Sikhism
        src('Orthodox Christianity', byKey('OrthodoxChristianity')),  // 13: Eastern Orthodox
        src('JTA Jewish News', byKey('JewishTelegraphicAgency')),  // 14: American Judaism
        src('Esoteric Spirituality', byKey('EsotericSpirituality'))   // 15: Non-traditional / New Age
      ]),
      population:     buildDomain('population',     [
        // 15 feeds, diversified across 4 collection methodologies. All keyless.
        // Targets fertility decline, post-COVID excess mortality, migration policy.
        src('World Bank Population', byKey('WorldBankPopulation')),   // 1: WB total population (JSON API)
        src('UN Population', byKey('UNPopulation')),   // 2: UN population API
        src('UNFPA', byKey('UNFPA')),  // 3: UN Population Fund (reproductive health)
        src('CDC NCHS', byKey('CDCNCHS')),  // 4: CDC National Center for Health Statistics
        src('WHO GHO', byKey('WHOGHO')),  // 5: WHO Global Health Observatory
        src('UNHCR Displacement', byKey('UNHCRDisplacement')),  // 6: UN refugee displacement
        src('IOM Migration', byKey('IOMmigration')),  // 7: International Org for Migration
        src('IHME Population Health', byKey('IHMEPopHealth')),  // 8: Institute for Health Metrics
        src('Guttmacher Institute', byKey('GuttmacherInstitute')),  // 9: reproductive health institute
        src('Census Bureau', byKey('CensusBureau')),  // 10: US Census Bureau
        src('Our World in Data Pop', byKey('OurWorldInDataPop')),  // 11: OWID demographic data
        src('Population Matters', byKey('PopulationMatters')),  // 12: pop policy advocacy
        src('World Bank Fertility', byKey('WorldBankFertility')),  // 13: WB Total Fertility Rate (direct decline data)
        src('Fed Reg Census', byKey('FedRegCensus')),  // 14: demographic-policy regulatory volume
        src('Fed Reg SSA', byKey('FedRegSSA'))   // 15: Social Security regulatory (aging strain)
      ]),
      law:            buildDomain('law',            [
        // 15 feeds, diversified across 4 collection methodologies. All keyless.
        // Existing law feeds (10)
        src('Federal Register', byKey('FederalRegister')),  // 1: federal regulatory catalog (JSON API)
        src('Regulations.gov', byKey('RegulationsGov')),  // 2: rule-comment platform (JSON API)
        src('CourtListener', byKey('CourtListener')),  // 3: federal docket (RSS proxy)
        src('PACER Docket Activity', byKey('PACERDocket')),  // 4: federal docket (RSS proxy)
        src('DOJ Press Releases', byKey('DOJPressReleases')),  // 5: DOJ enforcement RSS
        src('SEC Enforcement Actions', byKey('SECEnforcement')),  // 6: SEC enforcement RSS
        src('CFPB Enforcement', byKey('CFPBEnforcement')),  // 7: CFPB enforcement RSS
        src('U.S. Courts Federal Caseload', byKey('USCourtsFederalCaseload')),  // 8: uscourts.gov direct RSS
        src('HHS AFCARS Family Court', byKey('AFCARSFamilyCourt')),  // 9: family court RSS
        src('Supreme Court Opinions', byKey('SCOTUSOpinions')),  // 10: SCOTUS opinions RSS
        // Federal Register agency-specific (3 — institutional-decay angle)
        src('Fed Reg DOJ', byKey('FedRegDOJ')), // 11: Justice Department regulatory volume
        src('Fed Reg DEA', byKey('FedRegDEA')), // 12: drug-enforcement regulatory
        src('Fed Reg BOP', byKey('FedRegBOP')), // 13: Bureau of Prisons regulatory
        // Cross-domain reused keyless feeds (2)
        src('OFAC Recent Actions', byKey('OFACRecentActions')), // 14: sanctions / international law (reused)
        src('CISA KEV', byKey('CISAKEV_2'))  // 15: cyber-law gap (reused)
      ]),
      finance:        buildDomain('finance',        [
        src('Massive SPY', byKey('MassiveSPY')),
        src('Finnhub Market', byKey('Finnhub')),
        src('Alpha Vantage Market', byKey('AlphaVantage')),
        src('SEC EDGAR Filings', byKey('SECEDGARCurrent')),
        src('Treasury Yield Curve', byKey('TreasuryYieldCurve')),
        src('Treasury Debt', byKey('TreasuryDebt')),
        src('Fed H.4.1 Balance Sheet', byKey('FedH41')),
        src('FDIC Bank Failures', byKey('FDICBankFailures')),
        src('OCC Enforcement', byKey('OCCEnforcement')),
        src('CFTC Press', byKey('CFTCPress')),
        src('FINRA Disciplinary', byKey('FINRADisciplinary')),
        src('NY Fed SOFR', byKey('NYFedSOFR')),
        src('NCUA Credit Unions', byKey('NCUACreditUnion'))
      ], { clusterBoost: clusterBoosts.finance }),
      intelligence:   buildDomain('intelligence',   [
        // 15 feeds, diversified across 4 collection methodologies.
        // Dropped: Tavily (v39, key-gated), Recorded Future Intel (v135, key-gated).
        // RSS news (10 — institutional + analyst + OSINT)
        src('RSS Intel Signals', byKey('RSSIntel')),   // 1: broad intel keyword search
        src('CISA Advisories', byKey('CISAAdvisories')),  // 2: CISA RSS keyword
        src('NSA Cybersecurity Advisories', byKey('NSACybersecurityAdvisories')),  // 3: NSA cyber RSS
        src('FBI Cyber Division', byKey('FBICyberDiv')),  // 4: FBI cyber RSS
        src('DNI Annual Threat', byKey('DNIAnnualThreat')),  // 5: DNI threat assessment
        src('CyberScoop News', byKey('CyberScoopNews')),  // 6: cyber industry news
        src('The Record', byKey('TheRecord')),  // 7: cyber threat journalism
        src('Lawfare NatSec', byKey('LawfareNatSec')),  // 8: legal/policy analysis
        src('Bellingcat OSINT', byKey('BellingcatOSINT')),  // 9: OSINT investigation
        src('The Intercept NatSec', byKey('InterceptNatSec')),  // 10: surveillance/whistleblower journalism
        // JSON data API (1 — curated CVE list, distinct from RSS keyword)
        src('CISA KEV', byKey('CISAKEV_2')),  // 11: known-exploited CVEs (reused)
        // Federal Register doc-counts (3 — institutional regulatory volume)
        src('Fed Reg FBI', byKey('FedRegFBI')),  // 12: FBI regulatory
        src('Fed Reg CIA', byKey('FedRegCIA')),  // 13: CIA regulatory
        src('Fed Reg NSA', byKey('FedRegNSA')),  // 14: NSA regulatory
        // HTML scrape (1 — sanctions / counterintelligence overlap)
        src('OFAC Recent Actions', byKey('OFACRecentActions'))   // 15: sanctions designations (reused)
      ])
    };

    // GROUNDED STRESS PROMOTION (2026-07-20, ENERGY ONLY). This handler is the one the live
    // browser pages actually read (shared-snapshot-engine.js:22 fetches THIS endpoint, not
    // /api/limen-snapshot?type=console) via domain-brain-base.js:488 `this.state.stress =
    // this._rawDomain.stress`. It computes energy.stress from feed volume (buildDomain's
    // baselineStress+eventScore, ~line 1622) — the exact pattern that pins energy near 100%
    // when news coverage is high but real distress is low. The precision-weighted fusion
    // (lib/phase-estimator.js + lib/grounded-stress.js) already runs every 15 min in the
    // worker and is already promoted into `console_snapshot` (handlers/limen-worker-snapshot.js
    // :284) — that promotion never reached this endpoint, so the live site kept showing 100%
    // even after the worker-side fix. Read the already-computed value here (one Redis GET, no
    // recompute) so the actual displayed pages get it too. Fails soft: any error or missing/
    // stale key leaves domains.energy.stress exactly as computed above (feed-derived).
    try {
      var _cs = await db.get('console_snapshot');
      var _csEnergy = _cs && _cs.domains && _cs.domains.energy;
      if (_csEnergy && typeof _csEnergy.stress === 'number' && _csEnergy.stressSource === 'node-market-feed-grounded') {
        domains.energy._legacyFeedStress = domains.energy.stress;
        domains.energy.stress = _csEnergy.stress;
        domains.energy.finalStress = _csEnergy.stress;
        domains.energy.stressSource = _csEnergy.stressSource;
        // The basis has to be overridden too, or it keeps describing the feed-volume
        // computation this line just replaced. buildDomain sees energy's uncapped
        // value exceed its ceiling and calls it 'clamped'; the value actually
        // published here is the precision-weighted market fusion, which is the most
        // grounded reading in the system and is free to move across its full range.
        domains.energy.stressBasis = 'measured';
        domains.energy.stressUsable = true;
      }
    } catch (_pe) { /* never fatal — energy.stress stays feed-derived on any error */ }

    // Compute meta counts
    var liveCount = 0, partialCount = 0, fallbackCount = 0;
    for (var hk in _sourceHealth) {
      if (_sourceHealth[hk].status === 'live') liveCount++;
      else if (_sourceHealth[hk].status === 'partial') partialCount++;
      else fallbackCount++;
    }

    return res.status(200).json({
      domains: domains,
      meta: {
        snapshotId: now + '-' + liveCount,
        fetchedAt: now,
        liveCount: liveCount,
        partialCount: partialCount,
        fallbackCount: fallbackCount
      },
      sourceHealth: _sourceHealth
    });

  } catch (e) {
    console.error('[domain-snapshot] top-level error:', e.message);
    var errNow = Date.now();
    return res.status(200).json({
      domains: fallbackAll(),
      meta: {
        snapshotId: errNow + '-0',
        fetchedAt: errNow,
        liveCount: 0,
        partialCount: 0,
        fallbackCount: 40
      },
      sourceHealth: _sourceHealth,
      error: 'top-level failure: ' + e.message
    });
  }
};

// ─── Source wrapper ─────────────────────────────────────────────────────

function src(name, data) {
  return { name: name, data: data };
}

// ══════════════════════════════════════════════════════════════════════
// SIGNAL MATURITY DOMAIN MODEL (Phase 23)
//
// Each source returns: { stress, activity, channel, ... }
//   channel = 'stress' | 'activity' | 'context'
//
// buildDomain computes 4 dimensions:
//   stress     = deviation / severity / propagation (stress-channel only)
//   activity   = volume / pace (activity-channel)
//   confidence = weighted: sourceQuality + corroboration + specificity + recency
//   maturity   = EARLY | FORMING | CONFIRMED | STRUCTURAL
//
// Source quality tiers:
//   STRUCTURED_API = 1.0  (FRED, BLS, EIA, NOAA, FDA, USDA, World Bank)
//   KEYWORD_RSS    = 0.7  (defense/crisis RSS with event-family keywords)
//   GENERIC_RSS    = 0.4  (generic RSS article count)
//   STATIC         = 0.2  (rarely-changing structural indicators)
//
// ══════════════════════════════════════════════════════════════════════

// Source quality classification by source name patterns
var _SOURCE_QUALITY = {
  // Structured APIs
  'FRED': 1.0, 'BLS': 1.0, 'EIA': 1.0, 'NOAA': 1.0, 'openFDA': 1.0,
  'USDA': 1.0, 'World Bank': 0.9, 'OECD': 0.9, 'Massive': 0.95,
  'Finnhub': 0.9, 'Alpha': 0.9, 'Alpaca': 0.9, 'USPTO': 0.85,
  // Keyword RSS (event-family detection)
  'RSS Defense': 0.7, 'RSS Supply': 0.7, 'RSS Agriculture': 0.65,
  // Generic RSS / search
  'RSS ': 0.4, 'NewsAPI': 0.5, 'Tavily': 0.5,
  'Event Registry': 0.5, 'GDELT': 0.6,
  // Research volume
  'PubMed': 0.8, 'arXiv': 0.8, 'OpenAlex': 0.6,
  // Structural (static)
  'UN Pop': 0.3, 'FAO': 0.4, 'Regulations': 0.7, 'Federal Register': 0.7
};

function _getSourceQuality(sourceName) {
  for (var prefix in _SOURCE_QUALITY) {
    if (sourceName.indexOf(prefix) !== -1) return _SOURCE_QUALITY[prefix];
  }
  return 0.5;
}

// ══════════════════════════════════════════════════════════════════════
// GLOBAL FEED CLASSIFICATION (real / event / degraded / broken)
//
// Rules:
//   REAL     = stress-channel from a recognized structured numeric API
//              (FRED, BLS, EIA, NOAA, openFDA, USDA, World Bank, OECD,
//              USGS, CISA, OFAC, Treasury, NY Fed, Fed H.4.1, FDIC,
//              OCC, CFTC, FINRA, NCUA, Massive, Finnhub, Alpha, USPTO),
//              with numeric data.stress AND not _isRss-tagged.
//   EVENT    = RSS/news/headline feeds (Google News RSS, BBC, NewsAPI,
//              Tavily, Event Registry, GDELT) — narrative volume signal.
//              Carries an article count, NOT a structural metric.
//   DEGRADED = anything else with usable signal — doc-count regulatory
//              feeds, activity-only feeds, unrecognized stress (non-news
//              weak sources).
//   BROKEN   = no data, fetcher signaled fallback, or no usable
//              numeric value.
//
// Stress contribution: REAL only (baseline). EVENT contributes additively
//   via eventScore (PHASE 6). DEGRADED never drives stress.
// Activity contribution: REAL + DEGRADED + EVENT (preserves activity
//   numbers; event score is overlay-only).
// Confidence weight: REAL = 1.0, DEGRADED/EVENT = 0.5, BROKEN = 0.
//
// signalType (per-feed external label):
//   'structural' (real) | 'event' | 'degraded' | 'broken'
// ══════════════════════════════════════════════════════════════════════

var _STRUCTURED_SOURCE_PATTERNS = [
  'FRED', 'BLS', 'EIA', 'NOAA', 'openFDA', 'FDA Recalls', 'USDA',
  'World Bank', 'OECD', 'USGS', 'CISA', 'OFAC',
  'Treasury', 'NY Fed', 'Fed H.', 'FDIC', 'OCC', 'CFTC', 'FINRA', 'NCUA',
  'Massive', 'Finnhub', 'Alpha', 'USPTO'
];

// RSS/news/event-search source name patterns. A feed matching any of these
// (or carrying _isRss:true) is classified as EVENT, not DEGRADED.
var _EVENT_SOURCE_PATTERNS = [
  'RSS ', 'NewsAPI', 'Tavily', 'Event Registry', 'GDELT', 'BBC '
];

function _isStructuredSource(name) {
  if (!name) return false;
  for (var i = 0; i < _STRUCTURED_SOURCE_PATTERNS.length; i++) {
    if (name.indexOf(_STRUCTURED_SOURCE_PATTERNS[i]) !== -1) return true;
  }
  return false;
}

function _isEventSource(name) {
  if (!name) return false;
  for (var i = 0; i < _EVENT_SOURCE_PATTERNS.length; i++) {
    if (name.indexOf(_EVENT_SOURCE_PATTERNS[i]) !== -1) return true;
  }
  return false;
}

function _signalTypeFor(classification) {
  if (classification === 'real') return 'structural';
  if (classification === 'event') return 'event';
  if (classification === 'broken') return 'broken';
  return 'degraded';
}

// Cross-domain reused stress drivers. These can drive stress in many
// domains, but if EVERY real stress driver in a domain comes from this
// set, the domain has no domain-specific structural signal — cap at 0.3.
var _REUSED_STRESS_FEEDS = {
  'CISA KEV': true,
  'CISA Advisories': true,
  'NOAA NWS Alerts': true,
  'USGS Earthquakes': true,
  'OFAC Recent Actions': true,
  'FDA Recalls': true
};

function _classifyFeed(name, data) {
  if (!data) return 'broken';
  if (data.usingFallback === true) return 'broken';
  var hasStress = (typeof data.stress === 'number');
  var hasActivity = (typeof data.activity === 'number');
  if (!hasStress && !hasActivity) return 'broken';

  // RSS/news/event-search feeds → EVENT (narrative volume), regardless of
  // declared channel. _isRss flag (set by _fetchRSS) is the strongest signal;
  // source-name pattern catches BBC, NewsAPI, Tavily, Event Registry, GDELT.
  if (data._isRss === true || _isEventSource(name)) return 'event';

  var ch = data.channel || (hasStress ? 'stress' : 'activity');
  if (ch === 'stress' && hasStress && _isStructuredSource(name)) return 'real';
  return 'degraded';
}

// ══════════════════════════════════════════════════════════════════════
// ENERGY 3-TIER FEED RESOLVER
// Tier 1: EIA Brent (structural, daily, authoritative)
// Tier 2: Polygon CL (near-live, previous-day WTI)
// Tier 3: FRED WTI (structural fallback)
// Returns sources[] for buildDomain — single canonical price, not blind average
// ══════════════════════════════════════════════════════════════════════

var _energyLastKnownGood = null; // Server-side cache across warm invocations

function resolveEnergyFeeds(eia, polygon, fred) {
  var candidates = [];
  if (eia) candidates.push({ data: eia, name: 'EIA Petroleum', tier: 1, benchmark: 'Brent', role: 'structural' });
  if (polygon) candidates.push({ data: polygon, name: 'Polygon Crude Oil', tier: 2, benchmark: 'WTI', role: 'market' });
  if (fred) candidates.push({ data: fred, name: 'FRED Crude Oil', tier: 3, benchmark: 'WTI', role: 'fallback' });

  // Select primary: highest-tier live source
  var primary = null;
  var fallback = null;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!c.data || !c.data.value) continue;
    if (!primary) { primary = c; continue; }
    if (!fallback) { fallback = c; break; }
  }

  // If no live sources, use last-known-good cache
  if (!primary) {
    if (_energyLastKnownGood) {
      var cacheAge = Date.now() - (_energyLastKnownGood.timestamp || 0);
      var cacheAgeMin = Math.round(cacheAge / 60000);
      return [src('Energy Cache', {
        value: _energyLastKnownGood.value,
        label: 'CACHED $' + _energyLastKnownGood.value.toFixed(2) + ' (' + cacheAgeMin + 'm old)',
        stress: _energyLastKnownGood.stress,
        signal: 'DEGRADED: using cached price $' + _energyLastKnownGood.value.toFixed(2) + ' from ' + cacheAgeMin + 'm ago',
        updated: _energyLastKnownGood.timestamp,
        fetchedAt: Date.now(),
        channel: 'stress'
      })];
    }
    return [src('EIA Petroleum', null), src('Polygon Crude Oil', null)];
  }

  // Update last-known-good cache
  _energyLastKnownGood = { value: primary.data.value, stress: primary.data.stress, timestamp: Date.now() };

  // Add metadata to primary source
  primary.data.provider = primary.name;
  primary.data.benchmark = primary.benchmark;
  primary.data.role = primary.role;
  primary.data.tier = primary.tier;

  var sources = [src(primary.name, primary.data)];

  // Check divergence if fallback exists
  if (fallback && fallback.data.value) {
    var divergence = Math.abs(primary.data.value - fallback.data.value);
    // Brent-WTI spread is typically $5-15 — flag if > $20 (abnormal)
    if (primary.benchmark !== fallback.benchmark && divergence > 20) {
      primary.data.signal = primary.data.signal + ' | WARNING: $' + divergence.toFixed(0) + ' divergence from ' + fallback.name;
    } else if (primary.benchmark === fallback.benchmark && divergence > 5) {
      primary.data.signal = primary.data.signal + ' | WARNING: $' + divergence.toFixed(0) + ' divergence from ' + fallback.name + ' (same benchmark)';
    }

    // Add fallback as context source (not a stress driver)
    fallback.data.channel = 'context';
    fallback.data.provider = fallback.name;
    fallback.data.benchmark = fallback.benchmark;
    fallback.data.role = 'fallback';
    sources.push(src(fallback.name, fallback.data));
  }

  return sources;
}

function buildDomain(key, sources, opts) {
  opts = opts || {};
  var liveCount = 0;
  var signals = [];
  // signal TEXT -> { url, source }. Keyed by text rather than index because synthetic
  // signals get unshifted ("cluster boost") and pushed ("CAPPED: …", "LOW_SIGNAL: …")
  // later in this function; a parallel array would silently misalign. Anything with no
  // real link stays absent here and reads as null downstream — never a guessed URL.
  var signalMeta = Object.create(null);
  var sourceList = [];

  var stressDrivers = [];
  var activitySources = [];
  var contextSources = [];
  var allLive = []; // all live sources with quality scores

  // PHASE 1-2: classify and route each feed.
  // BROKEN  -> sourceList only (metadata); excluded from stress/activity/confidence.
  // DEGRADED -> never a stress driver; routed to activity (or context if it was context).
  // EVENT   -> RSS/news/headline feed; routed to activity for legacy compat AND
  //            tracked separately in eventFeeds[] to power the additive eventScore.
  // REAL    -> stress driver if channel=='stress'; deduped by canonical name within
  //            the domain so a single upstream feed can never inflate corroboration.
  var realCount = 0, degradedCount = 0, brokenCount = 0, eventCount = 0;
  var eventFeeds = [];
  var seenStressNames = Object.create(null);

  for (var i = 0; i < sources.length; i++) {
    var s = sources[i];
    var d = s.data;
    var classification = _classifyFeed(s.name, d);
    var signalType = _signalTypeFor(classification);

    if (classification === 'broken') {
      brokenCount++;
      var hb = _sourceHealth[s.name];
      var brokenReason = (hb && hb.reason) || 'unavailable';
      sourceList.push({
        name: s.name, value: null, label: brokenReason, channel: null,
        quality: 0, classification: 'broken', signalType: 'broken',
        updated: null, fetchedAt: Date.now(),
        sourceUpdatedAt: null, live: false, failReason: brokenReason
      });
      continue;
    }

    liveCount++;
    // Surface the REAL top headlines per feed (source-tagged) so the Signals dropdown shows what's
    // actually in the news, expandable per source — not a single generic line. RSS feeds carry
    // headlines[]; everything else keeps its single signal string.
    if (d.headlines && d.headlines.length) {
      for (var _sh = 0; _sh < Math.min(5, d.headlines.length); _sh++) {
        var _sTxt = s.name + ' — ' + d.headlines[_sh];
        signals.push(_sTxt);
        signalMeta[_sTxt] = { url: (d.headlineLinks && d.headlineLinks[_sh]) || null, source: s.name };
      }
    } else if (d.signal) {
      signals.push(d.signal);
      signalMeta[d.signal] = { url: d.signalUrl || null, source: s.name };
    }

    var ch = d.channel || 'stress';
    var sq = _getSourceQuality(s.name);
    var sourceEntry = {
      data: d, name: s.name, channel: ch, quality: sq,
      classification: classification,
      recency: d.fetchedAt ? (Date.now() - d.fetchedAt) : 0
    };
    allLive.push(sourceEntry);

    if (classification === 'real') {
      realCount++;
      if (ch === 'stress') {
        if (!seenStressNames[s.name]) {
          stressDrivers.push(sourceEntry);
          seenStressNames[s.name] = true;
        }
      } else if (ch === 'activity') {
        activitySources.push(sourceEntry);
      } else {
        contextSources.push(sourceEntry);
      }
    } else if (classification === 'event') {
      // EVENT: never drives baseline stress. Routed to activity for legacy
      // continuity (preserves activity numbers) AND tracked in eventFeeds[]
      // for additive eventScore (PHASE 6 — overlay-only, not baseline).
      eventCount++;
      eventFeeds.push(sourceEntry);
      if (ch === 'context') contextSources.push(sourceEntry);
      else activitySources.push(sourceEntry);
    } else {
      // DEGRADED: never drives stress, even if its declared channel was 'stress'.
      degradedCount++;
      if (ch === 'context') contextSources.push(sourceEntry);
      else activitySources.push(sourceEntry);
    }

    sourceList.push({
      name: s.name, value: d.value, label: d.label, channel: ch,
      quality: sq, classification: classification, signalType: signalType,
      updated: d.updated || Date.now(), fetchedAt: d.fetchedAt || Date.now(),
      sourceUpdatedAt: d.sourceUpdatedAt || null, live: true,
      // carry the real headlines + freshest-headline signal so the Signals dropdown can
      // expand each feed to its top stories (RSS feeds only; undefined elsewhere = omitted)
      headlines: (d.headlines && d.headlines.length) ? d.headlines : undefined,
      signal: d.signal || undefined,
      // RSS receptor diagnostics: raw page size, recency density and median article
      // age. Present only on RSS feeds; omitted (undefined) everywhere else. These
      // exist so receptor saturation and dead sources stay measurable from outside
      // the process, without a redeploy, the way /api/grounded-stress-history made
      // the channel histories readable.
      activity: (typeof d.activity === 'number') ? d.activity : undefined,
      rss: d._meta || undefined
    });
  }

  var stress, activity, confidence, maturity, cadence, status;
  var simulated = false;    // set only on the no-live-sources path below

  // ── Stress: from stress-driver sources only ──
  if (stressDrivers.length > 0) {
    var sSum = 0;
    for (var si = 0; si < stressDrivers.length; si++) sSum += (stressDrivers[si].data.stress || 0);
    stress = round(sSum / stressDrivers.length);
  } else if (activitySources.length > 0) {
    // Average over sources that actually CARRY an activity number. `|| 0` used to
    // count a source with no activity field as a measured zero, which silently
    // dragged the mean down in proportion to how many such sources a domain had.
    // See the matching change in the activity block below, and _fetchRSS.
    var aSum = 0, aN = 0;
    for (var ai = 0; ai < activitySources.length; ai++) {
      var _av = activitySources[ai].data.activity;
      if (typeof _av === 'number' && isFinite(_av)) { aSum += _av; aN++; }
    }
    stress = aN > 0 ? round(Math.min(0.25, (aSum / aN) * 0.3)) : 0.15;
  } else {
    stress = 0.15;
  }

  // Apply cluster boost if ingest data available (23C)
  // RULE: cluster boost may NOT override live feed stress — only supplement when no live stress
  if (opts.clusterBoost) {
    var cb = opts.clusterBoost;
    var hasLiveStress = stressDrivers.length > 0;
    if (!hasLiveStress && cb.clusterStress > stress) {
      // No live feeds — cluster boost fills the gap
      stress = round(cb.clusterStress);
    } else if (hasLiveStress && cb.clusterStress > stress) {
      // Live feeds exist — cluster only boosts by up to 0.15 (additive, not replacement)
      stress = round(Math.min(0.95, stress + Math.min(0.15, (cb.clusterStress - stress) * 0.3)));
    }
    if (cb.signal) signals.unshift(cb.signal);
  }

  // PHASE 3: cross-domain reuse cap. If every REAL stress driver in this
  // domain comes from the cross-domain reused set (CISA / NOAA NWS / USGS /
  // OFAC / FDA Recalls / CISA Advisories), the domain has no domain-specific
  // structural signal — cap stress at 0.3.
  if (stressDrivers.length > 0) {
    var allReused = true;
    for (var rdi = 0; rdi < stressDrivers.length; rdi++) {
      if (!_REUSED_STRESS_FEEDS[stressDrivers[rdi].name]) {
        allReused = false;
        break;
      }
    }
    if (allReused) {
      stress = round(Math.min(stress, 0.3));
      signals.push('CAPPED: stress drivers all cross-domain reused');
    }
  }

  // ── Activity: from activity-channel sources ──
  if (activitySources.length > 0) {
    // Denominator counts only sources carrying a real activity number (see above).
    // A source without one is missing data, not an observation of zero activity.
    var actSum = 0, actN = 0;
    for (var aci = 0; aci < activitySources.length; aci++) {
      var _acv = activitySources[aci].data.activity;
      if (typeof _acv === 'number' && isFinite(_acv)) { actSum += _acv; actN++; }
    }
    activity = actN > 0 ? round(actSum / actN) : 0;
  } else {
    activity = 0;
  }

  // ── Confidence: weighted multi-factor (23A) ──
  // w1: sourceQuality (0.35) — structured API vs RSS vs static
  // w2: corroboration (0.30) — multiple independent stress drivers
  // w3: specificity   (0.20) — keyword-clustered vs generic volume
  // w4: recency       (0.15) — data freshness
  var w1_quality = 0, w2_corr = 0, w3_spec = 0, w4_rec = 0;

  if (allLive.length > 0) {
    // PHASE 4: classification-weighted confidence.
    // REAL feeds = full weight; DEGRADED = 0.5; BROKEN = 0 (already excluded).
    var qSum = 0, wSum = 0;
    for (var qi = 0; qi < allLive.length; qi++) {
      var w = (allLive[qi].classification === 'real') ? 1.0 : 0.5;
      qSum += allLive[qi].quality * w;
      wSum += w;
    }
    w1_quality = wSum > 0 ? qSum / wSum : 0;

    // Corroboration: stressDrivers is already deduped by name, so no
    // single upstream feed can inflate this count.
    if (stressDrivers.length >= 2) w2_corr = 1.0;
    else if (stressDrivers.length === 1 && activitySources.length >= 1) w2_corr = 0.6;
    else if (stressDrivers.length === 1) w2_corr = 0.4;
    else if (activitySources.length >= 2) w2_corr = 0.3;
    else w2_corr = 0.15;

    // Specificity: only REAL stress drivers contribute.
    if (stressDrivers.length > 0) {
      var specSum = 0;
      for (var spi = 0; spi < stressDrivers.length; spi++) specSum += stressDrivers[spi].quality;
      w3_spec = specSum / stressDrivers.length;
    } else {
      w3_spec = 0.2; // activity-only domains have low specificity
    }

    // Recency: fraction of live (non-broken) sources fetched within last 5 minutes
    var freshCount = 0;
    for (var ri = 0; ri < allLive.length; ri++) {
      if (allLive[ri].recency < 300000) freshCount++;
    }
    w4_rec = allLive.length > 0 ? freshCount / allLive.length : 0;

    confidence = round(clamp(
      w1_quality * 0.35 + w2_corr * 0.30 + w3_spec * 0.20 + w4_rec * 0.15,
      0.05, 0.95
    ));
    cadence = 'daily';
    status = liveCount >= 2 ? 'LIVE' : 'PARTIAL';
  } else {
    confidence = 0.05;
    cadence = 'fallback';
    status = 'FALLBACK';
    var t = Date.now() * 0.0001;
    var offset = key.length * 1.7;
    stress = round(0.15 + Math.sin(t + offset) * 0.05);
    activity = 0;
    simulated = true;   // a sine wave of the clock. NEVER let this reach the recorder.
    signals.push('simulated - no live sources');
  }

  // PHASE 5: LOW_SIGNAL safety guard. If a domain has fewer than 2 REAL
  // feeds, cap stress at 0.3 and reduce confidence proportionally.
  var lowSignal = false;
  if (realCount < 2) {
    lowSignal = true;
    stress = round(Math.min(stress, 0.3));
    var confMult = realCount === 0 ? 0.5 : 0.75;
    confidence = round(clamp(confidence * confMult, 0.05, 0.95));
    signals.push('LOW_SIGNAL: ' + realCount + ' real feed(s)');
  }

  // ══════════════════════════════════════════════════════════════════════
  // PHASE 6: EVENT LAYER (additive overlay)
  //
  // Baseline stress (above) is structural-only. RSS/news feeds were
  // demoted out of baseline correctly — accurate but under-responsive.
  // The event layer restores fast signal WITHOUT corrupting baseline:
  //
  //   eventIntensity  = min(1, ln(1 + totalArticles) / 9)
  //                     ~100 articles → ~0.51, ~500 → ~0.69, ~1000 → ~0.77
  //   diversityFactor = unique event sources / total event feeds
  //   eventScore      = eventIntensity * diversityFactor
  //
  // Combination:
  //   low-signal: finalStress = min(0.3, baselineStress + eventScore*0.2)
  //   normal:     finalStress = min(1.0, baselineStress + eventScore*0.3)
  //
  // Invariants:
  //   - event feeds never enter stressDrivers (enforced upstream)
  //   - event layer cannot reduce baseline (additive only)
  //   - LOW_SIGNAL ceiling (0.3) preserved
  // ══════════════════════════════════════════════════════════════════════
  var baselineStress = stress;
  var eventScore = 0;
  if (eventFeeds.length > 0) {
    var totalArticles = 0;
    var seenEventNames = Object.create(null);
    var uniqueEventSources = 0;
    for (var ei = 0; ei < eventFeeds.length; ei++) {
      var ev = eventFeeds[ei];
      var v = (ev.data && typeof ev.data.value === 'number') ? ev.data.value : 0;
      if (v > 0) totalArticles += v;
      if (!seenEventNames[ev.name]) {
        seenEventNames[ev.name] = true;
        uniqueEventSources++;
      }
    }
    var eventIntensity = Math.min(1, Math.log(1 + totalArticles) / 9);
    var diversityFactor = eventFeeds.length > 0 ? (uniqueEventSources / eventFeeds.length) : 0;
    eventScore = round(eventIntensity * diversityFactor);
  }

  var ceiling = lowSignal ? 0.3 : 1;
  var uncappedStress = baselineStress + (eventScore * (lowSignal ? 0.2 : 0.3));
  var finalStress = round(Math.min(ceiling, uncappedStress));
  stress = finalStress;

  /**
   * IS THIS NUMBER A MEASUREMENT, OR IS IT THE GUARD RAIL?
   *
   * Established 2026-07-27 by replaying 262h of recorder history: five of the twenty
   * domains (culture, governance, health, population, technology) compute an uncapped
   * stress ABOVE their ceiling every single hour, so Math.min returns the ceiling
   * exactly, every time. The value they publish is the clamp, not a reading. It never
   * moves because it cannot.
   *
   * That is fine for display, where a capped number is the honest thing to show. It is
   * NOT fine downstream: the recorder stored the clamp, deriveForecast forecast the
   * clamp, the resolver graded "stable" correct against the clamp, and the reward came
   * back 1.0. Six domains were reporting perfect forecast accuracy off a guard rail.
   *
   * So the snapshot now says which it is. `stressUsable` is the flag the learning chain
   * reads; anything not `measured` must not be recorded as an observation. See
   * handlers/feed-record.js, which drops the value rather than storing a fiction.
   *
   *   simulated         no live sources at all: stress is a sine wave of the clock
   *   activity-fallback no stress-driver feed exists; derived from activity volume
   *   clamped           the computed value is at or above its ceiling, so min() pins it
   *   measured          a real stress driver, below the ceiling, free to move
   */
  var stressBasis;
  if (simulated) stressBasis = 'simulated';
  else if (stressDrivers.length === 0) stressBasis = 'activity-fallback';
  else if (uncappedStress >= ceiling) stressBasis = 'clamped';
  else stressBasis = 'measured';
  var stressUsable = stressBasis === 'measured';

  // ── Maturity classification (23B) ──
  // STRUCTURAL: stress > 0.5, confidence > 0.7, stress drivers >= 2
  // CONFIRMED:  stress > 0.4, confidence > 0.6, stress drivers >= 1
  // FORMING:    stress > 0.2, confidence > 0.3
  // EARLY:      everything else
  if (stress > 0.5 && confidence > 0.7 && stressDrivers.length >= 2) {
    maturity = 'STRUCTURAL';
  } else if (stress > 0.4 && confidence > 0.6 && stressDrivers.length >= 1) {
    maturity = 'CONFIRMED';
  } else if (stress > 0.2 && confidence > 0.3) {
    maturity = 'FORMING';
  } else {
    maturity = 'EARLY';
  }

  return {
    sources: sourceList,
    value: liveCount > 0 ? sourceList[0].value : null,
    change: 0,
    cadence: cadence,
    confidence: confidence,
    stress: stress,
    baselineStress: baselineStress,
    eventScore: eventScore,
    finalStress: finalStress,
    // Whether `stress` above is a reading or a guard rail. The learning chain gates
    // on stressUsable; the display does not have to. See the block above finalStress.
    stressBasis: stressBasis,
    stressUsable: stressUsable,
    uncappedStress: round(uncappedStress),
    stressCeiling: ceiling,
    activity: activity,
    maturity: maturity,
    updated: Date.now(),
    signals: signals,
    // index-aligned with signals[]; null where the feed gave no link or the signal is synthetic
    signalLinks: signals.map(function (t) { var m = signalMeta[t]; return (m && m.url) || null; }),
    signalSources: signals.map(function (t) { var m = signalMeta[t]; return (m && m.source) || null; }),
    liveCount: liveCount,
    status: status,
    lowSignal: lowSignal,
    _channels: {
      stressDriverCount: stressDrivers.length,
      activitySourceCount: activitySources.length,
      contextSourceCount: contextSources.length,
      eventFeedCount: eventFeeds.length
    },
    _classification: {
      real: realCount,
      event: eventCount,
      degraded: degradedCount,
      broken: brokenCount
    },
    _confidence: {
      sourceQuality: round(w1_quality),
      corroboration: round(w2_corr),
      specificity: round(w3_spec),
      recency: round(w4_rec)
    }
  };
}

function fallbackAll() {
  var keys = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
  var out = {};
  for (var i = 0; i < keys.length; i++) {
    out[keys[i]] = buildDomain(keys[i], [src('fallback A', null), src('fallback B', null)]);
  }
  return out;
}

// ─── Fetch with timeout + retry ────────────────────────────────────────

async function timedFetch(url, opts) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, TIMEOUT);
  try {
    var resp = await fetch(url, Object.assign({ signal: controller.signal }, opts || {}));
    clearTimeout(timer);
    return resp;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function fetchWithRetry(url, opts, retries) {
  retries = retries || 0;
  try {
    var resp = await timedFetch(url, opts);
    // Do not retry 429 — propagate immediately
    if (resp.status === 429) return resp;
    return resp;
  } catch (e) {
    if (retries < MAX_RETRIES) {
      await sleep(RETRY_DELAY * (retries + 1));
      return fetchWithRetry(url, opts, retries + 1);
    }
    throw e;
  }
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// BLS v2 request body helper (added 2026-07-21). Without a key the public API caps at 25
// calls/day/IP; production burns that across all three BLS feeds (employment, freight PPI,
// manufacturing PPI) and they fall back to `broken` — the runtime health board's industry
// realFeeds=0. A free key (https://data.bls.gov/registrationEngine/) raises the cap to 500/day and
// rides in the POST body as `registrationkey`. Additive + keyless-fallback: unset env = exactly the
// prior behavior. Operator action: register the free key, set env BLS_API_KEY.
function blsBody(seriesIds, startYear, endYear) {
  var b = { seriesid: seriesIds, startyear: String(startYear), endyear: String(endYear) };
  if (process.env.BLS_API_KEY) b.registrationkey = process.env.BLS_API_KEY;
  return JSON.stringify(b);
}

async function timedJSON(url, opts) {
  var resp = await fetchWithRetry(url, opts);
  if (!resp.ok) {
    var err = new Error('HTTP ' + resp.status);
    err.statusCode = resp.status;
    throw err;
  }
  return resp.json();
}

async function timedText(url, opts) {
  var resp = await fetchWithRetry(url, opts);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.text();
}

// ─── ECONOMY ────────────────────────────────────────────────────────────

async function fetchFRED() {
  var key = process.env.FRED_API_KEY;
  if (!key) {
    trackHealth('FRED CPI', 'economy', 'fallback', 'FRED_API_KEY not set');
    return null;
  }
  try {
    // Use CPI (Consumer Price Index YoY change) — more relevant for cost-of-goods pressure
    var data = await timedJSON(
      'https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=' + key + '&file_type=json&limit=2&sort_order=desc'
    );
    if (!data || !data.observations || data.observations.length < 2) {
      trackHealth('FRED CPI', 'economy', 'fallback', 'empty or insufficient CPI data');
      return null;
    }
    var latest = parseFloat(data.observations[0].value);
    var prior = parseFloat(data.observations[1].value);
    if (isNaN(latest) || isNaN(prior) || prior === 0) {
      trackHealth('FRED CPI', 'economy', 'fallback', 'non-numeric CPI value');
      return null;
    }
    // Monthly change as stress proxy — higher change = higher stress
    var monthlyChange = ((latest - prior) / prior) * 100;
    var val = round(monthlyChange);
    // Stress: 0.3% monthly change = moderate (0.5), 0.5%+ = high
    var stress = clamp(monthlyChange / 0.6, 0, 1);
    trackHealth('FRED CPI', 'economy', 'live', null, val);
    return { value: val, label: 'CPI change ' + val + '%', stress: round(stress), signal: 'consumer price change ' + val + '% (cost pressure)', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: data.observations[0].date || null };
  } catch (e) {
    trackHealth('FRED CPI', 'economy', 'fallback', e.message);
    return null;
  }
}

async function fetchBLS() {
  try {
    var body = blsBody(['CES0000000001'], new Date().getFullYear(), new Date().getFullYear());
    var data = await timedJSON('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body
    });
    if (!data || data.status !== 'REQUEST_SUCCEEDED') {
      var blsMsg = (data && data.message && data.message[0]) || 'request failed';
      trackHealth('BLS Employment', 'economy', 'fallback', 'BLS status: ' + blsMsg);
      return null;
    }
    if (!data.Results) {
      trackHealth('BLS Employment', 'economy', 'fallback', 'no Results in response');
      return null;
    }
    var series = data.Results.series && data.Results.series[0];
    if (!series || !series.data || !series.data[0]) {
      trackHealth('BLS Employment', 'economy', 'fallback', 'empty series data');
      return null;
    }
    var val = parseFloat(series.data[0].value);
    if (isNaN(val)) {
      trackHealth('BLS Employment', 'economy', 'fallback', 'non-numeric value');
      return null;
    }
    var stress = clamp((160000 - val) / 20000, 0, 1);
    var period = series.data[0].year + '-' + series.data[0].period;
    trackHealth('BLS Employment', 'economy', 'live', null, val);
    return { value: val, label: 'nonfarm payroll ' + (val / 1000).toFixed(0) + 'M', stress: round(stress), signal: 'employment ' + (val / 1000).toFixed(1) + 'M', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: period };
  } catch (e) {
    trackHealth('BLS Employment', 'economy', 'fallback', e.message);
    return null;
  }
}

async function fetchFREDGasPrice() {
  var key = process.env.FRED_API_KEY;
  if (!key) { trackHealth('FRED Gas Price', 'economy', 'fallback', 'FRED_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://api.stlouisfed.org/fred/series/observations?series_id=GASREGW&api_key=' + key + '&file_type=json&limit=2&sort_order=desc');
    if (!data || !data.observations || !data.observations[0]) { trackHealth('FRED Gas Price', 'economy', 'fallback', 'empty'); return null; }
    var val = parseFloat(data.observations[0].value);
    if (isNaN(val) || data.observations[0].value === '.') { trackHealth('FRED Gas Price', 'economy', 'fallback', 'non-numeric'); return null; }
    var stress = clamp((val - 2.50) / 2.50, 0, 1);
    trackHealth('FRED Gas Price', 'economy', 'live', null, val);
    return { value: val, label: 'gas $' + val.toFixed(2) + '/gal', stress: round(stress), signal: 'gas price $' + val.toFixed(2), name: 'FRED Gas Price', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('FRED Gas Price', 'economy', 'fallback', e.message); return null; }
}

async function fetchFREDFoodCPI() {
  var key = process.env.FRED_API_KEY;
  if (!key) { trackHealth('FRED Food CPI', 'economy', 'fallback', 'FRED_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://api.stlouisfed.org/fred/series/observations?series_id=CPIUFDNS&api_key=' + key + '&file_type=json&limit=2&sort_order=desc');
    if (!data || !data.observations || !data.observations[0]) { trackHealth('FRED Food CPI', 'economy', 'fallback', 'empty'); return null; }
    var curr = parseFloat(data.observations[0].value);
    var prev = data.observations[1] ? parseFloat(data.observations[1].value) : curr;
    if (isNaN(curr) || data.observations[0].value === '.') { trackHealth('FRED Food CPI', 'economy', 'fallback', 'non-numeric'); return null; }
    var pctChange = prev > 0 ? round(((curr - prev) / prev) * 100) : 0;
    var stress = clamp(Math.abs(pctChange) / 0.8, 0, 1);
    trackHealth('FRED Food CPI', 'economy', 'live', null, curr);
    return { value: pctChange, label: 'food CPI ' + (pctChange >= 0 ? '+' : '') + pctChange + '%', stress: round(stress), signal: 'food price index', name: 'FRED Food CPI', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('FRED Food CPI', 'economy', 'fallback', e.message); return null; }
}

async function fetchFREDConsumerSentiment() {
  var key = process.env.FRED_API_KEY;
  if (!key) { trackHealth('FRED Consumer Sentiment', 'economy', 'fallback', 'FRED_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://api.stlouisfed.org/fred/series/observations?series_id=UMCSENT&api_key=' + key + '&file_type=json&limit=1&sort_order=desc');
    if (!data || !data.observations || !data.observations[0]) { trackHealth('FRED Consumer Sentiment', 'economy', 'fallback', 'empty'); return null; }
    var val = parseFloat(data.observations[0].value);
    if (isNaN(val) || data.observations[0].value === '.') { trackHealth('FRED Consumer Sentiment', 'economy', 'fallback', 'non-numeric'); return null; }
    var stress = clamp((100 - val) / 50, 0, 1);
    trackHealth('FRED Consumer Sentiment', 'economy', 'live', null, val);
    return { value: val, label: 'consumer sentiment ' + val.toFixed(1), stress: round(stress), signal: 'consumer sentiment index', name: 'FRED Consumer Sentiment', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('FRED Consumer Sentiment', 'economy', 'fallback', e.message); return null; }
}

// ─── ENERGY ─────────────────────────────────────────────────────────────

async function fetchEIA() {
  var key = process.env.EIA_API_KEY;
  if (!key) {
    trackHealth('EIA Petroleum', 'energy', 'fallback', 'EIA_API_KEY not set');
    return null;
  }
  try {
    var data = await timedJSON(
      'https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=' + key + '&frequency=daily&data[0]=value&facets[product][]=EPCBRENT&sort[0][column]=period&sort[0][direction]=desc&length=1'
    );
    if (!data || !data.response || !data.response.data || !data.response.data[0]) {
      trackHealth('EIA Petroleum', 'energy', 'fallback', 'empty response');
      return null;
    }
    var row = data.response.data[0];
    var val = parseFloat(row.value);
    if (isNaN(val)) {
      trackHealth('EIA Petroleum', 'energy', 'fallback', 'non-numeric value');
      return null;
    }
    var stress = clamp((val - 60) / 50, 0, 1);
    trackHealth('EIA Petroleum', 'energy', 'live', null, val);
    return { value: val, label: 'Brent $' + val.toFixed(2), stress: round(stress), signal: 'crude oil $' + val.toFixed(0) + '/bbl', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: row.period || null };
  } catch (e) {
    trackHealth('EIA Petroleum', 'energy', 'fallback', e.message);
    return null;
  }
}

async function fetchFREDEnergy() {
  var key = process.env.FRED_API_KEY;
  if (!key) {
    trackHealth('FRED Crude Oil', 'energy', 'fallback', 'FRED_API_KEY not set');
    return null;
  }
  try {
    var data = await timedJSON(
      'https://api.stlouisfed.org/fred/series/observations?series_id=DCOILWTICO&api_key=' + key + '&file_type=json&limit=1&sort_order=desc'
    );
    if (!data || !data.observations || !data.observations[0]) {
      trackHealth('FRED Crude Oil', 'energy', 'fallback', 'empty response');
      return null;
    }
    var obs = data.observations[0];
    var val = parseFloat(obs.value);
    if (isNaN(val) || val === 0 || obs.value === '.') {
      trackHealth('FRED Crude Oil', 'energy', 'fallback', 'non-numeric value: ' + obs.value);
      return null;
    }
    var stress = clamp((val - 55) / 50, 0, 1);
    trackHealth('FRED Crude Oil', 'energy', 'live', null, val);
    return { value: val, label: 'WTI $' + val.toFixed(2), stress: round(stress), signal: 'WTI crude $' + val.toFixed(0), updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: obs.date || null };
  } catch (e) {
    trackHealth('FRED Crude Oil', 'energy', 'fallback', e.message);
    return null;
  }
}

// ─── ENVIRONMENT ────────────────────────────────────────────────────────

async function fetchNOAAClimate() {
  var token = process.env.NOAA_TOKEN;
  if (!token) {
    trackHealth('NOAA Climate', 'environment', 'fallback', 'NOAA_TOKEN not set');
    return null;
  }
  try {
    var end = new Date().toISOString().slice(0, 10);
    var start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    var resp = await fetchWithRetry(
      'https://www.ncdc.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&datatypeid=TAVG&startdate=' + start + '&enddate=' + end + '&limit=5&units=standard',
      { headers: { token: token } }
    );
    if (!resp.ok) {
      trackHealth('NOAA Climate', 'environment', 'fallback', 'HTTP ' + resp.status);
      return null;
    }
    var data = await resp.json();
    if (!data.results || !data.results.length) {
      trackHealth('NOAA Climate', 'environment', 'fallback', 'no results in response');
      return null;
    }
    var avg = 0;
    for (var i = 0; i < data.results.length; i++) avg += data.results[i].value;
    avg = avg / data.results.length;
    var anomaly = (avg - 55) / 30;
    var stress = clamp(Math.abs(anomaly) * 0.7, 0, 1);
    trackHealth('NOAA Climate', 'environment', 'live', null, round(anomaly));
    return { value: round(anomaly), label: 'temp anomaly ' + anomaly.toFixed(2) + '\u00B0', stress: round(stress), signal: 'temperature deviation detected', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: data.results[0].date || null };
  } catch (e) {
    trackHealth('NOAA Climate', 'environment', 'fallback', e.message);
    return null;
  }
}

async function fetchNOAAAlerts() {
  var SEVERITY_W = { Extreme: 1.0, Severe: 0.75, Moderate: 0.4, Minor: 0.1, Unknown: 0.05 };
  try {
    var data = await timedJSON(
      'https://api.weather.gov/alerts/active?status=actual',
      { headers: { 'User-Agent': '(limen-helix, contact@limenhelix.com)', 'Accept': 'application/geo+json' } }
    );
    if (!data || !data.features) {
      trackHealth('NOAA Alerts', 'environment', 'fallback', 'no features in response');
      return null;
    }
    var features = data.features;
    var count = features.length;
    var now = Date.now();

    // Compute LIMEN environmental signal from alert properties
    var severitySum = 0;
    var expiresRemaining = [];
    for (var i = 0; i < count; i++) {
      var props = features[i].properties;
      if (!props) continue;
      severitySum += SEVERITY_W[props.severity] || 0.05;
      if (props.expires) {
        var rem = new Date(props.expires).getTime() - now;
        if (rem > 0) expiresRemaining.push(rem);
      }
    }

    var disturbanceCount = count;
    var disturbanceIntensity = count > 0 ? round(severitySum / count) : 0;
    var disturbanceNovelty = 0; // no historical baseline yet
    var disturbancePersistence = 0;
    if (expiresRemaining.length > 0) {
      var avgRemMs = 0;
      for (var j = 0; j < expiresRemaining.length; j++) avgRemMs += expiresRemaining[j];
      avgRemMs = avgRemMs / expiresRemaining.length;
      // Normalize: 24h remaining = 1.0
      disturbancePersistence = round(clamp(avgRemMs / (24 * 3600000), 0, 1));
    }

    // Overall stress: blend of severity intensity and count pressure
    var countPressure = clamp(count / 50, 0, 1);
    var stress = round(clamp(disturbanceIntensity * 0.6 + countPressure * 0.4, 0, 1));

    var label = count + ' active alert' + (count !== 1 ? 's' : '');
    trackHealth('NOAA Alerts', 'environment', 'live', null, count);
    return {
      value: count,
      label: label,
      stress: stress,
      signal: count > 0 ? count + ' weather alerts (avg severity ' + disturbanceIntensity + ')' : 'no active alerts',
      updated: now,
      fetchedAt: now,
      sourceUpdatedAt: null,
      activeAlerts: count,
      disturbanceCount: disturbanceCount,
      disturbanceIntensity: disturbanceIntensity,
      disturbanceNovelty: disturbanceNovelty,
      disturbancePersistence: disturbancePersistence
    };
  } catch (e) {
    trackHealth('NOAA Alerts', 'environment', 'fallback', e.message);
    return null;
  }
}

// ─── HEALTH ─────────────────────────────────────────────────────────────

async function fetchFDAEvents() {
  try {
    var data = await timedJSON('https://api.fda.gov/drug/event.json?limit=1');
    if (!data || !data.meta || !data.meta.results) {
      trackHealth('openFDA Events', 'health', 'fallback', 'missing meta.results');
      return null;
    }
    var total = data.meta.results.total;
    var act = clamp(total / 25000000, 0, 1);
    trackHealth('openFDA Events', 'health', 'live', null, total);
    return { value: total, label: (total / 1000000).toFixed(1) + 'M adverse events tracked', activity: round(act), channel: 'activity', signal: 'FDA adverse event volume ' + (total / 1000000).toFixed(1) + 'M', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: data.meta.last_updated || null };
  } catch (e) {
    trackHealth('openFDA Events', 'health', 'fallback', e.message);
    return null;
  }
}

async function fetchFDARecalls() {
  try {
    var today = new Date().toISOString().slice(0, 10);
    var monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    var data = await timedJSON('https://api.fda.gov/drug/enforcement.json?search=report_date:[' + monthAgo.replace(/-/g, '') + '+TO+' + today.replace(/-/g, '') + ']&limit=1');
    if (!data || !data.meta || !data.meta.results) {
      trackHealth('openFDA Recalls', 'health', 'fallback', 'missing meta.results');
      return null;
    }
    var total = data.meta.results.total;
    var stress = clamp(total / 100, 0, 1);
    trackHealth('openFDA Recalls', 'health', 'live', null, total);
    return { value: total, label: total + ' drug recalls (30d)', stress: round(stress), channel: 'stress', signal: total + ' recent drug enforcement actions', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: data.meta.last_updated || null };
  } catch (e) {
    trackHealth('openFDA Recalls', 'health', 'fallback', e.message);
    return null;
  }
}

// ─── HEALTH EXPANSION (4 additional sources) ────────────────────────────
// openFDA Events and openFDA Recalls already feed Medicine via existing
// fetches at indices 6 and 7. These four add public-health surveillance
// (CDC), global epidemic tracking (WHO), pharmaceutical supply (FDA
// Drug Shortages), and clinical research activity (ClinicalTrials.gov).

async function fetchCDCMMWR() {
  try {
    var xml = await timedText('https://tools.cdc.gov/api/v2/resources/media/316422.rss', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 30, 0.05, 1.0);
      trackHealth('CDC MMWR', 'health', 'live', null, count);
      return { value: count, label: count + ' MMWR items', activity: round(act), channel: 'activity', signal: count + ' CDC public health items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty MMWR RSS');
  } catch (e) {
    return _fetchRSS('CDC MMWR OR CDC weekly OR CDC outbreak OR CDC public health alert', 'CDC MMWR', 'health', 'activity');
  }
}

async function fetchWHODiseaseOutbreak() {
  try {
    var xml = await timedText('https://www.who.int/feeds/entity/csr/don/en/rss.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('WHO Disease Outbreak', 'health', 'live', null, count);
      return { value: count, label: count + ' WHO outbreak items', activity: round(act), channel: 'activity', signal: count + ' WHO disease outbreak items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty WHO RSS');
  } catch (e) {
    return _fetchRSS('WHO disease outbreak OR World Health Organization epidemic OR pandemic alert OR public health emergency', 'WHO Disease Outbreak', 'health', 'activity');
  }
}

async function fetchFDADrugShortages() {
  try {
    // openFDA exposes shortages via the drug/shortages endpoint with meta.results.total
    var data = await timedJSON('https://api.fda.gov/drug/shortages.json?limit=1', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (data && data.meta && data.meta.results) {
      var count = data.meta.results.total || 0;
      var act = clamp(count / 200, 0.05, 1.0);
      trackHealth('FDA Drug Shortages', 'health', 'live', null, count);
      return { value: count, label: count + ' tracked drug shortages', activity: round(act), channel: 'activity', signal: count + ' FDA-tracked drug shortages', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: data.meta.last_updated || null };
    }
    throw new Error('empty FDA shortages response');
  } catch (e) {
    return _fetchRSS('FDA drug shortage OR pharmaceutical shortage OR medication shortage', 'FDA Drug Shortages', 'health', 'activity');
  }
}

async function fetchClinicalTrials() {
  try {
    // ClinicalTrials.gov v2 API — count of studies updated in last 30 days
    var url = 'https://clinicaltrials.gov/api/v2/studies?countTotal=true&pageSize=1&filter.advanced=' + encodeURIComponent('AREA[LastUpdatePostDate]RANGE[MAX-30days,MAX]');
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (data && data.totalCount != null) {
      var count = data.totalCount;
      var act = clamp(count / 5000, 0.05, 1.0);
      trackHealth('ClinicalTrials.gov', 'health', 'live', null, count);
      return { value: count, label: count + ' trials updated (30d)', activity: round(act), channel: 'activity', signal: count + ' clinical trial updates', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty ClinicalTrials response');
  } catch (e) {
    return _fetchRSS('clinical trial registration OR new clinical trial OR clinical trial results', 'ClinicalTrials.gov', 'health', 'activity');
  }
}

// ─── TECHNOLOGY ─────────────────────────────────────────────────────────

async function fetchPatents() {
  var key = process.env.USPTO_API_KEY;
  if (!key) {
    trackHealth('USPTO Patents', 'technology', 'fallback', 'USPTO_API_KEY not set');
    return null;
  }
  try {
    // USPTO Patent Applications Search — primary patent feed
    // Response: { count, patentFileWrapperDataBag: [...] }
    var resp = await fetchWithRetry(
      'https://api.uspto.gov/api/v1/patent/applications/search?searchText=*&rows=25&start=0&sortField=lastIngestionDateTime&sortOrder=desc',
      { headers: { 'X-Api-Key': key, 'Accept': 'application/json' } }
    );
    if (!resp.ok) {
      trackHealth('USPTO Patents', 'technology', 'fallback', 'HTTP ' + resp.status);
      return null;
    }
    var data = await resp.json();
    if (!data || !data.patentFileWrapperDataBag || !Array.isArray(data.patentFileWrapperDataBag)) {
      var shape = data ? Object.keys(data).join(',') : 'null';
      console.warn('[fetchPatents] unexpected shape — keys:', shape, 'type:', typeof data);
      trackHealth('USPTO Patents', 'technology', 'fallback', 'unexpected shape: ' + shape);
      return null;
    }

    var total = data.count || data.patentFileWrapperDataBag.length;
    var apps = data.patentFileWrapperDataBag;
    var count = apps.length;

    // Art unit ranges → LIMEN domain
    var AU_RANGES = [
      [1600, 1699, 'health'], [1700, 1799, 'environment'],
      [2100, 2199, 'technology'], [2400, 2499, 'technology'],
      [2600, 2699, 'technology'], [2800, 2899, 'technology'],
      [3600, 3699, 'supplyChain'], [3700, 3799, 'energy'],
      [3900, 3999, 'technology']
    ];
    // USPC class → domain (fallback)
    var USPC_MAP = {
      '128': 'health', '424': 'health', '435': 'health', '514': 'health', '600': 'health',
      '345': 'technology', '370': 'technology', '455': 'technology', '700': 'technology', '706': 'technology', '707': 'technology', '709': 'technology', '726': 'technology',
      '290': 'energy', '310': 'energy', '320': 'energy', '322': 'energy', '324': 'energy', '429': 'energy',
      '422': 'environment', '423': 'environment', '502': 'environment', '544': 'environment',
      '137': 'supplyChain', '198': 'supplyChain', '414': 'supplyChain', '426': 'supplyChain'
    };

    var domainCounts = {};
    var domainsHit = {};

    for (var i = 0; i < count; i++) {
      var meta = apps[i].applicationMetaData || {};
      var domain = 'technology'; // default

      // Classify by art unit first
      var auStr = meta.groupArtUnitNumber;
      if (auStr) {
        var auNum = parseInt(auStr, 10);
        if (!isNaN(auNum)) {
          for (var r = 0; r < AU_RANGES.length; r++) {
            if (auNum >= AU_RANGES[r][0] && auNum <= AU_RANGES[r][1]) {
              domain = AU_RANGES[r][2]; break;
            }
          }
        }
      } else {
        // Fallback to USPC
        var uspc = meta.uspcSymbolText;
        if (uspc) {
          var cls = uspc.split('/')[0].trim();
          if (USPC_MAP[cls]) domain = USPC_MAP[cls];
        }
      }
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      domainsHit[domain] = true;
    }

    // Domain spread entropy (normalized to 7 domains, log2(7) ≈ 2.807)
    var spread = 0;
    var dKeys = Object.keys(domainCounts);
    if (dKeys.length > 0) {
      for (var s = 0; s < dKeys.length; s++) {
        var p = domainCounts[dKeys[s]] / count;
        if (p > 0) spread -= p * Math.log(p) / Math.log(2);
      }
      spread = clamp(spread / 2.807, 0, 1);
    }

    // Innovation pressure from statuses
    var STATUS_W = { 'Patented Case': 1.0, 'Allowed -- Notice of Allowance Mailed': 0.9, 'Docketed New Case - Ready for Examination': 0.7, 'Sent to Classification contractor': 0.6, 'Non Final Action Mailed': 0.5, 'Final Rejection Mailed': 0.3 };
    var pressureSum = 0;
    var pressureN = 0;
    for (var ip = 0; ip < count; ip++) {
      var st = (apps[ip].applicationMetaData || {}).applicationStatusDescriptionText;
      if (st) { pressureSum += STATUS_W[st] || 0.4; pressureN++; }
    }
    var pressure = pressureN > 0 ? pressureSum / pressureN : 0.4;

    var crossDomain = Object.keys(domainsHit).length / 7;
    var filingRate = clamp(total / 200000, 0, 1);

    var act = round(clamp(
      pressure * 0.40 + spread * 0.20 + crossDomain * 0.20 + filingRate * 0.20,
      0, 1
    ));

    var domainCount = Object.keys(domainsHit).length;
    trackHealth('USPTO Patents', 'technology', 'live', null, total);
    return {
      value: total,
      label: (total / 1000).toFixed(0) + 'K applications (' + domainCount + ' domains)',
      activity: act,
      channel: 'activity',
      signal: 'patent applications: ' + (total / 1000).toFixed(0) + 'K total, spread ' + round(spread),
      updated: Date.now(),
      fetchedAt: Date.now(),
      sourceUpdatedAt: apps[0] ? (apps[0].lastIngestionDateTime || null) : null,
      patentSignals: {
        classificationSpread: round(spread),
        innovationPressure: round(pressure),
        crossDomainActivity: round(crossDomain),
        filingRate: round(filingRate),
        domainsHit: Object.keys(domainsHit),
        domainCounts: domainCounts
      }
    };
  } catch (e) {
    trackHealth('USPTO Patents', 'technology', 'fallback', e.message);
    return null;
  }
}

async function fetchArXivCS() {
  try {
    // Small delay to stagger from fetchArXivAll (arXiv rate limit: 3 req/s)
    var xml = await timedText('https://export.arxiv.org/api/query?search_query=cat:cs.*&sortBy=submittedDate&sortOrder=descending&max_results=1');
    if (!xml) {
      trackHealth('arXiv CS', 'technology', 'fallback', 'empty response');
      return null;
    }
    // Check for rate limit response
    if (xml.indexOf('rate limit') !== -1 || xml.indexOf('retry') !== -1) {
      trackHealth('arXiv CS', 'technology', 'fallback', 'rate limited');
      return null;
    }
    var match = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
    if (!match) {
      trackHealth('arXiv CS', 'technology', 'fallback', 'totalResults not found in XML');
      return null;
    }
    var total = parseInt(match[1], 10);
    var daily = total / 365;
    var act = clamp(daily / 1500, 0, 1);
    trackHealth('arXiv CS', 'technology', 'live', null, total);
    return { value: total, label: (total / 1000).toFixed(0) + 'K CS papers', activity: round(act), channel: 'activity', signal: 'CS research volume ' + daily.toFixed(0) + '/day', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: null };
  } catch (e) {
    trackHealth('arXiv CS', 'technology', 'fallback', e.message);
    return null;
  }
}

// ─── RESEARCH ───────────────────────────────────────────────────────────

async function fetchPubMed() {
  try {
    var year = new Date().getFullYear();
    var xml = await timedText('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&rettype=count&term=' + year + '[pdat]');
    if (!xml) {
      trackHealth('PubMed', 'research', 'fallback', 'empty response');
      return null;
    }
    var match = xml.match(/<Count>(\d+)<\/Count>/);
    if (!match) {
      trackHealth('PubMed', 'research', 'fallback', 'Count not found in XML');
      return null;
    }
    var total = parseInt(match[1], 10);
    var dayOfYear = Math.floor((Date.now() - new Date(year, 0, 1).getTime()) / 86400000) || 1;
    var daily = total / dayOfYear;
    var act = clamp(daily / 8000, 0, 1);
    trackHealth('PubMed', 'research', 'live', null, total);
    return { value: total, label: (total / 1000000).toFixed(2) + 'M PubMed articles', activity: round(act), channel: 'activity', signal: 'publication rate ~' + daily.toFixed(0) + '/day', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: null };
  } catch (e) {
    trackHealth('PubMed', 'research', 'fallback', e.message);
    return null;
  }
}

async function fetchArXivAll() {
  try {
    // Stagger 500ms after arXiv CS to avoid rate limit
    await sleep(500);
    var xml = await timedText('https://export.arxiv.org/api/query?search_query=all&sortBy=submittedDate&sortOrder=descending&max_results=1');
    if (!xml) {
      trackHealth('arXiv All', 'research', 'fallback', 'empty response');
      return null;
    }
    if (xml.indexOf('rate limit') !== -1 || xml.indexOf('retry') !== -1) {
      trackHealth('arXiv All', 'research', 'fallback', 'rate limited');
      return null;
    }
    var match = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
    if (!match) {
      trackHealth('arXiv All', 'research', 'fallback', 'totalResults not found in XML');
      return null;
    }
    var total = parseInt(match[1], 10);
    var act = clamp((total / 365) / 2000, 0, 1);
    trackHealth('arXiv All', 'research', 'live', null, total);
    return { value: total, label: (total / 1000000).toFixed(2) + 'M arXiv papers', activity: round(act), channel: 'activity', signal: 'arXiv volume ' + (total / 1000).toFixed(0) + 'K total', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: null };
  } catch (e) {
    trackHealth('arXiv All', 'research', 'fallback', e.message);
    return null;
  }
}

// ─── SUPPLY CHAIN ───────────────────────────────────────────────────────

async function fetchBLSFreight() {
  try {
    var body = blsBody(['PCU484121484121'], new Date().getFullYear(), new Date().getFullYear());
    var data = await timedJSON('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body
    });
    if (!data || data.status !== 'REQUEST_SUCCEEDED') {
      var blsMsg = (data && data.message && data.message[0]) || 'request failed';
      trackHealth('BLS Freight PPI', 'supplyChain', 'fallback', 'BLS status: ' + blsMsg);
      return null;
    }
    if (!data.Results) {
      trackHealth('BLS Freight PPI', 'supplyChain', 'fallback', 'no Results in response');
      return null;
    }
    var series = data.Results.series && data.Results.series[0];
    if (!series || !series.data || !series.data[0]) {
      trackHealth('BLS Freight PPI', 'supplyChain', 'fallback', 'empty series data');
      return null;
    }
    var val = parseFloat(series.data[0].value);
    if (isNaN(val)) {
      trackHealth('BLS Freight PPI', 'supplyChain', 'fallback', 'non-numeric value');
      return null;
    }
    var stress = clamp((val - 110) / 50, 0, 1);
    var period = series.data[0].year + '-' + series.data[0].period;
    trackHealth('BLS Freight PPI', 'supplyChain', 'live', null, val);
    return { value: val, label: 'freight PPI ' + val.toFixed(1), stress: round(stress), signal: 'freight cost index ' + val.toFixed(1), updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: period };
  } catch (e) {
    trackHealth('BLS Freight PPI', 'supplyChain', 'fallback', e.message);
    return null;
  }
}

async function fetchEIASupply() {
  var key = process.env.EIA_API_KEY;
  if (!key) {
    trackHealth('EIA Supply', 'supplyChain', 'fallback', 'EIA_API_KEY not set');
    return null;
  }
  try {
    var data = await timedJSON(
      'https://api.eia.gov/v2/petroleum/sum/sndw/data/?api_key=' + key + '&frequency=weekly&data[0]=value&facets[product][]=EPC0&sort[0][column]=period&sort[0][direction]=desc&length=1'
    );
    if (!data || !data.response || !data.response.data || !data.response.data[0]) {
      trackHealth('EIA Supply', 'supplyChain', 'fallback', 'empty response');
      return null;
    }
    var row = data.response.data[0];
    var val = parseFloat(row.value);
    if (isNaN(val)) {
      trackHealth('EIA Supply', 'supplyChain', 'fallback', 'non-numeric value');
      return null;
    }
    var stress = clamp((440 - val) / 60, 0, 1);
    trackHealth('EIA Supply', 'supplyChain', 'live', null, val);
    return { value: val, label: 'crude stocks ' + val.toFixed(0) + 'Mb', stress: round(stress), signal: 'crude inventory ' + val.toFixed(0) + 'M barrels', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: row.period || null };
  } catch (e) {
    trackHealth('EIA Supply', 'supplyChain', 'fallback', e.message);
    return null;
  }
}

// ─── GOVERNANCE ─────────────────────────────────────────────────────────

async function fetchWorldBankGovernance() {
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/CC.EST?format=json&date=2015:2024&per_page=5');
    var val = _extractWorldBankValue(data);
    if (val === null) { trackHealth('World Bank Governance', 'governance', 'fallback', 'no non-null value in response'); return null; }
    // CC.EST ranges roughly -2.5 to 2.5; higher = better control of corruption. Invert for stress.
    var stress = clamp((1.5 - val) / 3, 0, 1);
    trackHealth('World Bank Governance', 'governance', 'live', null, val);
    return { value: round(val), label: 'governance score ' + val.toFixed(2), stress: round(stress), signal: 'control of corruption index ' + val.toFixed(2), updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: data[1][0].date || null };
  } catch (e) { trackHealth('World Bank Governance', 'governance', 'fallback', e.message); return null; }
}

// ── Free World Bank numeric drivers added to starved domains (real stress signal,
//    lifts them out of the 0-real-driver LOW_SIGNAL cap). All keyless. ──
async function fetchWBGovEffectiveness() {
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/GE.EST?format=json&date=2015:2024&per_page=5');
    var val = _extractWorldBankValue(data);
    if (val === null) { trackHealth('World Bank Gov Effectiveness', 'governance', 'fallback', 'no non-null value'); return null; }
    var stress = clamp((1.5 - val) / 3, 0, 1); // GE.EST ~ -2.5..2.5, higher=better → invert
    trackHealth('World Bank Gov Effectiveness', 'governance', 'live', null, val);
    return { value: round(val), label: 'gov effectiveness ' + val.toFixed(2), stress: round(stress), signal: 'government effectiveness index ' + val.toFixed(2), updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: (data[1] && data[1][0] && data[1][0].date) || null };
  } catch (e) { trackHealth('World Bank Gov Effectiveness', 'governance', 'fallback', e.message); return null; }
}

async function fetchWBRuleOfLaw() {
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/RL.EST?format=json&date=2015:2024&per_page=5');
    var val = _extractWorldBankValue(data);
    if (val === null) { trackHealth('World Bank Rule of Law', 'governance', 'fallback', 'no non-null value'); return null; }
    var stress = clamp((1.5 - val) / 3, 0, 1); // RL.EST ~ -2.5..2.5, higher=better → invert
    trackHealth('World Bank Rule of Law', 'governance', 'live', null, val);
    return { value: round(val), label: 'rule of law ' + val.toFixed(2), stress: round(stress), signal: 'rule of law index ' + val.toFixed(2), updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: (data[1] && data[1][0] && data[1][0].date) || null };
  } catch (e) { trackHealth('World Bank Rule of Law', 'governance', 'fallback', e.message); return null; }
}

async function fetchWBInternetUsers() {
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/IT.NET.USER.ZS?format=json&date=2012:2024&per_page=12');
    var val = _extractWorldBankValue(data);
    if (val === null) { trackHealth('World Bank Internet Users', 'communication', 'fallback', 'no non-null value'); return null; }
    var stress = clamp((100 - val) / 100, 0, 1); // % individuals using internet, higher=better connectivity → invert
    trackHealth('World Bank Internet Users', 'communication', 'live', null, val);
    return { value: round(val), label: 'internet users ' + val.toFixed(1) + '%', stress: round(stress), signal: 'individuals using the internet ' + val.toFixed(1) + '%', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: (data[1] && data[1][0] && data[1][0].date) || null };
  } catch (e) { trackHealth('World Bank Internet Users', 'communication', 'fallback', e.message); return null; }
}

async function fetchWBLogisticsLPI() {
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/LP.LPI.OVRL.XQ?format=json&date=2012:2024&per_page=12');
    var val = _extractWorldBankValue(data);
    if (val === null) { trackHealth('World Bank Logistics Index', 'supplyChain', 'fallback', 'no non-null value'); return null; }
    var stress = clamp((5 - val) / 4, 0, 1); // LPI 1..5, higher=better logistics → invert
    trackHealth('World Bank Logistics Index', 'supplyChain', 'live', null, val);
    return { value: round(val), label: 'logistics index ' + val.toFixed(2), stress: round(stress), signal: 'logistics performance index ' + val.toFixed(2) + '/5', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: (data[1] && data[1][0] && data[1][0].date) || null };
  } catch (e) { trackHealth('World Bank Logistics Index', 'supplyChain', 'fallback', e.message); return null; }
}

async function fetchWBManufacturing() {
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/NV.MNF.TOTL.ZS?format=json&date=2012:2024&per_page=12');
    var val = _extractWorldBankValue(data);
    if (val === null) { trackHealth('World Bank Manufacturing', 'industry', 'fallback', 'no non-null value'); return null; }
    var stress = clamp((18 - val) / 18, 0, 1); // manufacturing %GDP, lower share = higher structural stress
    trackHealth('World Bank Manufacturing', 'industry', 'live', null, val);
    return { value: round(val), label: 'manufacturing ' + val.toFixed(1) + '% GDP', stress: round(stress), signal: 'manufacturing value added ' + val.toFixed(1) + '% of GDP', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: (data[1] && data[1][0] && data[1][0].date) || null };
  } catch (e) { trackHealth('World Bank Manufacturing', 'industry', 'fallback', e.message); return null; }
}

async function fetchGDELTGovernance() {
  return _fetchGDELT('GDELT Governance', 'governance', 'governance%20policy');
}

// ─── INFRASTRUCTURE ─────────────────────────────────────────────────────

async function fetchWorldBankInfra() {
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/IS.RRS.TOTL.KM?format=json&date=2010:2024&per_page=10');
    var val = _extractWorldBankValue(data);
    if (val === null) { trackHealth('World Bank Infrastructure', 'infrastructure', 'fallback', 'no non-null value'); return null; }
    trackHealth('World Bank Infrastructure', 'infrastructure', 'live', null, val);
    return { value: val, label: 'rail km ' + val, activity: 0.3, channel: 'context', signal: 'infrastructure index', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('World Bank Infrastructure', 'infrastructure', 'fallback', e.message); return null; }
}

async function fetchOECDInfra() {
  try {
    var resp = await fetchWithRetry('https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_NAMAIN1@DF_QNA_EXPENDITURE_USD,1.0/USA.B1GQ.V..Q?lastNObservations=1', { headers: { Accept: 'application/vnd.sdmx.data+json;version=2.0.0' } });
    if (!resp.ok) { trackHealth('OECD Infrastructure', 'infrastructure', 'fallback', 'HTTP ' + resp.status); return null; }
    var data = await resp.json();
    var val = 0;
    try { val = data.data.dataSets[0].series['0:0:0:0:0'].observations['0'][0]; } catch (_) {}
    trackHealth('OECD Infrastructure', 'infrastructure', 'live', null, val);
    return { value: val, label: 'OECD GDP index', activity: 0.25, channel: 'context', signal: 'infrastructure GDP indexed', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('OECD Infrastructure', 'infrastructure', 'fallback', e.message); return null; }
}

async function fetchFREDConstructionSpending() {
  var key = process.env.FRED_API_KEY;
  if (!key) { trackHealth('FRED Construction Spending', 'infrastructure', 'fallback', 'FRED_API_KEY not set'); return null; }
  try {
    var data = await timedJSON(
      'https://api.stlouisfed.org/fred/series/observations?series_id=TTLCON&api_key=' + key + '&file_type=json&limit=2&sort_order=desc'
    );
    if (!data || !data.observations || !data.observations[0]) { trackHealth('FRED Construction Spending', 'infrastructure', 'fallback', 'empty response'); return null; }
    var curr = parseFloat(data.observations[0].value);
    var prev = data.observations[1] ? parseFloat(data.observations[1].value) : curr;
    if (isNaN(curr) || data.observations[0].value === '.') { trackHealth('FRED Construction Spending', 'infrastructure', 'fallback', 'non-numeric'); return null; }
    var pctChange = prev > 0 ? round(((curr - prev) / prev) * 100) : 0;
    trackHealth('FRED Construction Spending', 'infrastructure', 'live', null, curr);
    return { value: pctChange, label: 'construction spending ' + (pctChange >= 0 ? '+' : '') + pctChange + '%', stress: clamp(Math.abs(pctChange) / 10, 0, 1), signal: 'construction spending index', name: 'FRED Construction Spending', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('FRED Construction Spending', 'infrastructure', 'fallback', e.message); return null; }
}

async function fetchFREDTransportationIndex() {
  var key = process.env.FRED_API_KEY;
  if (!key) { trackHealth('FRED Transportation Index', 'infrastructure', 'fallback', 'FRED_API_KEY not set'); return null; }
  try {
    var data = await timedJSON(
      'https://api.stlouisfed.org/fred/series/observations?series_id=TSIFRGHT&api_key=' + key + '&file_type=json&limit=2&sort_order=desc'
    );
    if (!data || !data.observations || !data.observations[0]) { trackHealth('FRED Transportation Index', 'infrastructure', 'fallback', 'empty response'); return null; }
    var curr = parseFloat(data.observations[0].value);
    var prev = data.observations[1] ? parseFloat(data.observations[1].value) : curr;
    if (isNaN(curr) || data.observations[0].value === '.') { trackHealth('FRED Transportation Index', 'infrastructure', 'fallback', 'non-numeric'); return null; }
    var pctChange = prev > 0 ? round(((curr - prev) / prev) * 100) : 0;
    trackHealth('FRED Transportation Index', 'infrastructure', 'live', null, curr);
    return { value: pctChange, label: 'freight transport ' + (pctChange >= 0 ? '+' : '') + pctChange + '%', stress: clamp(Math.abs(pctChange) / 8, 0, 1), signal: 'transport freight index', name: 'FRED Transportation Index', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('FRED Transportation Index', 'infrastructure', 'fallback', e.message); return null; }
}

async function fetchFREDFederalInvestment() {
  var key = process.env.FRED_API_KEY;
  if (!key) { trackHealth('FRED Federal Investment', 'infrastructure', 'fallback', 'FRED_API_KEY not set'); return null; }
  try {
    var data = await timedJSON(
      'https://api.stlouisfed.org/fred/series/observations?series_id=A782RC1Q027SBEA&api_key=' + key + '&file_type=json&limit=2&sort_order=desc'
    );
    if (!data || !data.observations || !data.observations[0]) { trackHealth('FRED Federal Investment', 'infrastructure', 'fallback', 'empty response'); return null; }
    var curr = parseFloat(data.observations[0].value);
    var prev = data.observations[1] ? parseFloat(data.observations[1].value) : curr;
    if (isNaN(curr) || data.observations[0].value === '.') { trackHealth('FRED Federal Investment', 'infrastructure', 'fallback', 'non-numeric'); return null; }
    var pctChange = prev > 0 ? round(((curr - prev) / prev) * 100) : 0;
    trackHealth('FRED Federal Investment', 'infrastructure', 'live', null, curr);
    return { value: pctChange, label: 'federal spending ' + (pctChange >= 0 ? '+' : '') + pctChange + '%', stress: clamp(Math.abs(pctChange) / 12, 0, 1), signal: 'federal infrastructure spending', name: 'FRED Federal Investment', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('FRED Federal Investment', 'infrastructure', 'fallback', e.message); return null; }
}

// ─── AGRICULTURE ────────────────────────────────────────────────────────

async function fetchUSDA() {
  var key = process.env.USDA_API_KEY;
  if (!key) { trackHealth('USDA NASS', 'agriculture', 'fallback', 'USDA_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://quickstats.nass.usda.gov/api/api_GET/?key=' + key + '&commodity_desc=CORN&statisticcat_desc=YIELD&year__GE=' + (new Date().getFullYear() - 1) + '&agg_level_desc=NATIONAL&format=JSON');
    if (!data || !data.data || !data.data[0]) { trackHealth('USDA NASS', 'agriculture', 'fallback', 'empty response'); return null; }
    var val = parseFloat(data.data[0].Value);
    if (isNaN(val)) { trackHealth('USDA NASS', 'agriculture', 'fallback', 'non-numeric'); return null; }
    var stress = clamp((180 - val) / 50, 0, 1); // corn yield below 180 bu/acre = stress
    trackHealth('USDA NASS', 'agriculture', 'live', null, val);
    return { value: val, label: 'corn yield ' + val + ' bu/ac', stress: round(stress), signal: 'crop yield ' + val + ' bu/acre', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('USDA NASS', 'agriculture', 'fallback', e.message); return null; }
}

async function fetchFAO() {
  try {
    var yr = new Date().getFullYear() - 2;
    var data = await timedJSON('https://www.fao.org/faostat/api/v1/en/data/QCL?area_code=231&element_code=5510&item_code=15&year_code=' + yr);
    if (!data || (!data.data && !data.value)) {
      // Try alternate response shapes
      if (Array.isArray(data) && data.length > 0) {
        var val = data[0].Value || data[0].value || 0;
        trackHealth('FAO FAOSTAT', 'agriculture', 'live', null, val);
        return { value: val, label: 'wheat ' + val, activity: 0.3, channel: 'context', signal: 'wheat output indexed', updated: Date.now(), fetchedAt: Date.now() };
      }
      trackHealth('FAO FAOSTAT', 'agriculture', 'fallback', 'unexpected response shape');
      return null;
    }
    var val2 = (data.data && data.data[0]) ? (data.data[0].Value || data.data[0].value || 0) : (data.value || 0);
    trackHealth('FAO FAOSTAT', 'agriculture', 'live', null, val2);
    return { value: val2, label: 'wheat production ' + val2, activity: 0.3, channel: 'context', signal: 'global wheat output indexed', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('FAO FAOSTAT', 'agriculture', 'fallback', e.message); return null; }
}

// ─── INDUSTRY ───────────────────────────────────────────────────────────

async function fetchFREDIndustry() {
  var key = process.env.FRED_API_KEY;
  if (!key) { trackHealth('FRED Industrial Production', 'industry', 'fallback', 'FRED_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://api.stlouisfed.org/fred/series/observations?series_id=INDPRO&api_key=' + key + '&file_type=json&limit=1&sort_order=desc');
    if (!data || !data.observations || !data.observations[0]) { trackHealth('FRED Industrial Production', 'industry', 'fallback', 'empty response'); return null; }
    var obs = data.observations[0];
    var val = parseFloat(obs.value);
    if (isNaN(val) || obs.value === '.') { trackHealth('FRED Industrial Production', 'industry', 'fallback', 'non-numeric'); return null; }
    var stress = clamp((105 - val) / 15, 0, 1); // index below 105 = contraction stress
    trackHealth('FRED Industrial Production', 'industry', 'live', null, val);
    return { value: val, label: 'INDPRO ' + val.toFixed(1), stress: round(stress), signal: 'industrial production index ' + val.toFixed(1), updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: obs.date || null };
  } catch (e) { trackHealth('FRED Industrial Production', 'industry', 'fallback', e.message); return null; }
}

async function fetchBLSManufacturing() {
  try {
    var body = blsBody(['PCUOMFG--OMFG--'], new Date().getFullYear() - 1, new Date().getFullYear());
    var data = await timedJSON('https://api.bls.gov/publicAPI/v2/timeseries/data/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body });
    if (!data || data.status !== 'REQUEST_SUCCEEDED' || !data.Results || !data.Results.series || !data.Results.series[0] || !data.Results.series[0].data || !data.Results.series[0].data[0]) { trackHealth('BLS Manufacturing PPI', 'industry', 'fallback', 'BLS status: ' + (data ? data.status : 'null') + (data && data.message ? ' — ' + data.message[0] : '')); return null; }
    var val = parseFloat(data.Results.series[0].data[0].value);
    if (isNaN(val)) { trackHealth('BLS Manufacturing PPI', 'industry', 'fallback', 'non-numeric'); return null; }
    var stress = clamp((val - 120) / 40, 0, 1);
    trackHealth('BLS Manufacturing PPI', 'industry', 'live', null, val);
    return { value: val, label: 'mfg PPI ' + val.toFixed(1), stress: round(stress), signal: 'manufacturing PPI ' + val.toFixed(0), updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('BLS Manufacturing PPI', 'industry', 'fallback', e.message); return null; }
}

// ─── EDUCATION ──────────────────────────────────────────────────────────

async function fetchWorldBankEducation() {
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/SE.XPD.TOTL.GD.ZS?format=json&date=2015:2024&per_page=5');
    var val = _extractWorldBankValue(data);
    if (val === null) { trackHealth('World Bank Education', 'education', 'fallback', 'no non-null value'); return null; }
    var stress = clamp((6 - val) / 3, 0, 1); // below 6% GDP = stress
    trackHealth('World Bank Education', 'education', 'live', null, val);
    return { value: round(val), label: 'edu spend ' + val.toFixed(1) + '% GDP', stress: round(stress), signal: 'education expenditure ' + val.toFixed(1) + '% GDP', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: data[1][0].date || null };
  } catch (e) { trackHealth('World Bank Education', 'education', 'fallback', e.message); return null; }
}

async function fetchOpenAlex() {
  try {
    var data = await timedJSON('https://api.openalex.org/institutions?filter=country_code:US&sort=works_count:desc&per_page=1&mailto=limen@limenhelix.com');
    if (!data || !data.results || !data.results[0]) { trackHealth('OpenAlex Institutions', 'education', 'fallback', 'empty response'); return null; }
    var val = data.results[0].works_count || 0;
    trackHealth('OpenAlex Institutions', 'education', 'live', null, val);
    return { value: val, label: 'top inst. works ' + (val/1000000).toFixed(1) + 'M', activity: 0.2, channel: 'context', signal: 'research institution output indexed', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('OpenAlex Institutions', 'education', 'fallback', e.message); return null; }
}

// ─── COMMUNICATION ──────────────────────────────────────────────────────

async function fetchNewsAPI() {
  var key = process.env.NEWS_API_KEY;
  if (!key) { trackHealth('NewsAPI Headlines', 'communication', 'fallback', 'NEWS_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://newsapi.org/v2/top-headlines?country=us&pageSize=5&apiKey=' + key);
    if (!data || data.status !== 'ok' || !data.articles) { trackHealth('NewsAPI Headlines', 'communication', 'fallback', 'bad response'); return null; }
    var count = data.totalResults || 0;
    var act = clamp(count / 500, 0, 1);
    trackHealth('NewsAPI Headlines', 'communication', 'live', null, count);
    return { value: count, label: count + ' headlines', activity: round(act), channel: 'activity', signal: count + ' active news stories', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('NewsAPI Headlines', 'communication', 'fallback', e.message); return null; }
}

async function fetchGDELTMedia() {
  return _fetchGDELT('GDELT Media', 'communication', 'media%20communication');
}

// ─── CULTURE ────────────────────────────────────────────────────────────

async function fetchEventRegistryCulture() {
  var key = process.env.EVENT_REGISTRY_API_KEY;
  if (!key) { trackHealth('Event Registry', 'culture', 'fallback', 'EVENT_REGISTRY_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://eventregistry.org/api/v1/article/getArticles?apiKey=' + key + '&keyword=culture%20arts&articlesCount=5&resultType=articles');
    if (!data || !data.articles || !data.articles.results) { trackHealth('Event Registry', 'culture', 'fallback', 'no articles'); return null; }
    var count = data.articles.totalResults || 0;
    var act = clamp(count / 10000, 0, 1);
    trackHealth('Event Registry', 'culture', 'live', null, count);
    return { value: count, label: count + ' cultural articles', activity: round(act), channel: 'activity', signal: 'cultural activity volume ' + count, updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Event Registry', 'culture', 'fallback', e.message); return null; }
}

async function fetchGDELTTone() {
  return _fetchGDELT('GDELT Tone', 'culture', 'culture%20society');
}

// ─── DEFENSE ────────────────────────────────────────────────────────────

async function fetchACLED() {
  // ACLED is historically unreliable — fast-fail with 1.5s timeout
  // Defense primary sensing is now handled by /api/defense-signals (RSS)
  var key = process.env.ACLED_API_KEY;
  if (!key) { trackHealth('ACLED Conflict', 'defense', 'fallback', 'ACLED_API_KEY not set'); return null; }
  try {
    var email = process.env.ACLED_EMAIL || '';
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 1500);
    var resp = await fetch('https://api.acleddata.com/acled/read?key=' + key + '&email=' + encodeURIComponent(email) + '&limit=10', { signal: controller.signal });
    clearTimeout(timeoutId);
    var data = await resp.json();
    if (!data || !data.data) { trackHealth('ACLED Conflict', 'defense', 'fallback', 'empty response'); return null; }
    var count = data.count || data.data.length || 0;
    var stress = clamp(count / 50, 0, 1);
    trackHealth('ACLED Conflict', 'defense', 'live', null, count);
    return { value: count, label: count + ' conflict events', stress: round(stress), signal: count + ' global conflict events', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('ACLED Conflict', 'defense', 'fallback', e.message || 'timeout/aborted'); return null; }
}

async function fetchGDELTConflict() {
  return _fetchGDELT('GDELT Conflict', 'defense', 'conflict%20military%20security');
}

// ─── RELIGION ───────────────────────────────────────────────────────────

async function fetchGDELTReligion() {
  return _fetchGDELT('GDELT Religion', 'religion', 'religion%20faith%20theology');
}

async function fetchEventRegistryReligion() {
  var key = process.env.EVENT_REGISTRY_API_KEY;
  if (!key) { trackHealth('Event Registry Religion', 'religion', 'fallback', 'EVENT_REGISTRY_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://eventregistry.org/api/v1/article/getArticles?apiKey=' + key + '&keyword=religion%20faith&articlesCount=5&resultType=articles');
    if (!data || !data.articles || !data.articles.results) { trackHealth('Event Registry Religion', 'religion', 'fallback', 'no articles'); return null; }
    var count = data.articles.totalResults || 0;
    var act = clamp(count / 5000, 0, 1);
    trackHealth('Event Registry Religion', 'religion', 'live', null, count);
    return { value: count, label: count + ' religion articles', activity: round(act), channel: 'activity', signal: 'religious media volume ' + count, updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Event Registry Religion', 'religion', 'fallback', e.message); return null; }
}

// ─── POPULATION ─────────────────────────────────────────────────────────

async function fetchWorldBankPopulation() {
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/SP.POP.TOTL?format=json&date=2015:2024&per_page=5');
    var val = _extractWorldBankValue(data);
    if (val === null) { trackHealth('World Bank Population', 'population', 'fallback', 'no non-null value'); return null; }
    trackHealth('World Bank Population', 'population', 'live', null, val);
    return { value: val, label: 'pop ' + (val/1000000).toFixed(1) + 'M', activity: 0.25, channel: 'context', signal: 'population ' + (val/1000000).toFixed(0) + ' million', updated: Date.now(), fetchedAt: Date.now(), sourceUpdatedAt: data[1][0].date || null };
  } catch (e) { trackHealth('World Bank Population', 'population', 'fallback', e.message); return null; }
}

async function fetchUNPopulation() {
  var key = process.env.UN_POPULATION_API_KEY;
  if (!key) { trackHealth('UN Population', 'population', 'fallback', 'UN_POPULATION_API_KEY not set'); return null; }
  try {
    var headers = { 'Authorization': 'Bearer ' + key };
    var resp = await timedFetch('https://population.un.org/dataportalapi/api/v1/data/indicators/49/locations/840/start/2023/end/2025?pageSize=1', { headers: headers });
    var data = await resp.json();
    if (!data || !data.data || !data.data[0]) { trackHealth('UN Population', 'population', 'fallback', 'empty response'); return null; }
    var val = data.data[0].value || 0;
    trackHealth('UN Population', 'population', 'live', null, val);
    return { value: round(val), label: 'UN pop ' + (val/1000).toFixed(0) + 'M', activity: 0.2, channel: 'context', signal: 'UN population estimate', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('UN Population', 'population', 'fallback', e.message); return null; }
}

// ─── LAW ────────────────────────────────────────────────────────────────

async function fetchFederalRegister() {
  try {
    var data = await timedJSON('https://www.federalregister.gov/api/v1/documents.json?per_page=5&order=newest&conditions%5Btype%5D=RULE');
    if (!data || !data.results) { trackHealth('Federal Register', 'law', 'fallback', 'empty response'); return null; }
    var total = data.count || 0;
    var recentCount = data.results.length;
    var act = clamp(recentCount / 10, 0.1, 1.0);
    trackHealth('Federal Register', 'law', 'live', null, total);
    return { value: total, label: total + ' recent rules', activity: round(act), channel: 'activity', signal: total + ' federal rules published', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Federal Register', 'law', 'fallback', e.message); return null; }
}

async function fetchRegulationsGov() {
  var key = process.env.REGULATIONS_GOV_API_KEY;
  if (!key) { trackHealth('Regulations.gov', 'law', 'fallback', 'REGULATIONS_GOV_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://api.regulations.gov/v4/documents?api_key=' + key + '&filter[postedDate]=' + new Date().toISOString().slice(0, 10) + '&page[size]=5');
    if (!data || !data.data) { trackHealth('Regulations.gov', 'law', 'fallback', 'empty response'); return null; }
    var count = data.meta ? data.meta.totalElements || data.data.length : data.data.length;
    var act = clamp(count / 150, 0.05, 1.0);
    trackHealth('Regulations.gov', 'law', 'live', null, count);
    return { value: count, label: count + ' regs today', activity: round(act), channel: 'activity', signal: count + ' regulations posted', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Regulations.gov', 'law', 'fallback', e.message); return null; }
}

// ─── LAW EXPANSION (8 additional sources) ──────────────────────────────
// CourtListener has a real public REST API. SEC EDGAR has a public full-text
// search endpoint. DOJ has a public Drupal JSON endpoint. uscourts.gov and
// SCOTUSblog publish RSS. The remaining feeds (PACER, CFPB, AFCARS) have no
// browser-fetchable JSON, so they fall through to Google News RSS keyword
// counting via the existing _fetchRSS helper — same pattern Defense / Religion
// / Governance / Media / Culture / Intel already use.

async function fetchCourtListener() {
  // CourtListener REST API requires an authenticated token (returns HTTP 401
  // anonymous as of 2026-04). Rather than hold an env var for a token I don't
  // have, route through the existing _fetchRSS Google News proxy with court-
  // ruling keywords. Same pattern PACER / CFPB / AFCARS use.
  return _fetchRSS('federal court ruling OR federal court opinion OR federal docket activity OR federal litigation filed', 'CourtListener', 'law', 'activity');
}

async function fetchPACERDocket() {
  // PACER requires authenticated user credentials and is not viable as a free
  // public fetch. Use Google News RSS as a federal-docket activity proxy.
  return _fetchRSS('federal court filing OR federal lawsuit filed OR class action filing OR federal case docket', 'PACER Docket Activity', 'law', 'activity');
}

async function fetchDOJPressReleases() {
  try {
    var data = await timedJSON('https://www.justice.gov/api/v1/press_release.json?pagesize=20', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (data && data.results && data.results.length > 0) {
      var count = data.results.length;
      var act = clamp(count / 30, 0.05, 1.0);
      trackHealth('DOJ Press Releases', 'law', 'live', null, count);
      return { value: count, label: count + ' DOJ press releases', activity: round(act), channel: 'activity', signal: count + ' DOJ enforcement actions', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty response');
  } catch (e) {
    return _fetchRSS('Department of Justice indictment OR DOJ enforcement OR federal prosecution OR DOJ charges', 'DOJ Press Releases', 'law', 'activity');
  }
}

async function fetchSECEnforcement() {
  // EDGAR full-text search returned shape but 0 hits (form/query mismatch).
  // SEC publishes a press releases RSS that includes enforcement announcements.
  // Falls through to Google News if SEC RSS itself errors.
  try {
    var xml = await timedText('https://www.sec.gov/news/pressreleases.rss', { headers: { 'User-Agent': 'LIMEN-Helix/1.0 contact@limenhelix.com' } });
    var items = (xml.match(/<item>/gi) || []).length;
    // Count only items whose title or description suggests enforcement
    var enforcementMatches = (xml.match(/charge[ds]?|fine[ds]?|enforcement|penalt|fraud|settlement|order|cease and desist|injunct|prosecut/gi) || []).length;
    if (items > 0) {
      // Use enforcement-keyword density as the signal — items count is the ceiling
      var count = Math.max(enforcementMatches, items);
      var act = clamp(count / 60, 0.05, 1.0);
      trackHealth('SEC Enforcement Actions', 'law', 'live', null, count);
      return { value: count, label: count + ' SEC press release items', activity: round(act), channel: 'activity', signal: count + ' SEC enforcement signals', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty SEC RSS');
  } catch (e) {
    return _fetchRSS('SEC enforcement action OR SEC fines OR SEC charges OR SEC consent decree OR SEC fraud charges', 'SEC Enforcement Actions', 'law', 'activity');
  }
}

async function fetchCFPBEnforcement() {
  // CFPB enforcement actions are published as HTML, no JSON API. RSS proxy.
  return _fetchRSS('CFPB enforcement OR CFPB fines OR CFPB consent order OR Consumer Financial Protection Bureau action', 'CFPB Enforcement', 'law', 'activity');
}

async function fetchUSCourtsFederalCaseload() {
  try {
    var xml = await timedText('https://www.uscourts.gov/news/rss', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('U.S. Courts Federal Caseload', 'law', 'live', null, count);
      return { value: count, label: count + ' uscourts.gov news items', activity: round(act), channel: 'activity', signal: count + ' federal court news items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty RSS');
  } catch (e) {
    return _fetchRSS('federal court ruling OR federal judiciary OR federal district court OR federal bankruptcy court', 'U.S. Courts Federal Caseload', 'law', 'activity');
  }
}

async function fetchAFCARSFamilyCourt() {
  // AFCARS data is published as PDF reports, no API. Use family-law RSS proxy.
  return _fetchRSS('family court OR child welfare OR foster care OR parental rights termination OR child protective services OR custody dispute', 'HHS AFCARS Family Court', 'law', 'activity');
}

async function fetchSCOTUSOpinions() {
  try {
    var xml = await timedText('https://www.scotusblog.com/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('Supreme Court Opinions', 'law', 'live', null, count);
      return { value: count, label: count + ' SCOTUSblog items', activity: round(act), channel: 'activity', signal: count + ' Supreme Court items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty RSS');
  } catch (e) {
    return _fetchRSS('Supreme Court ruling OR SCOTUS opinion OR Supreme Court decision OR Supreme Court case', 'Supreme Court Opinions', 'law', 'activity');
  }
}

// ─── SCIENCE EXPANSION (4 additional sources) ──────────────────────────
// PubMed and arXiv All already feed Science via existing fetches at indices
// 10 and 11. These four add NSF awards, research integrity (Retraction Watch),
// NIH grants, and Nature/Science press signals. All use either direct RSS
// from real .gov / publisher endpoints or the _fetchRSS Google News fallback.

async function fetchNSFAwards() {
  try {
    var xml = await timedText('https://www.nsf.gov/news/news_list.jsp?org=NSF&type=press', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/news_summ\.jsp/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 50, 0.05, 1.0);
      trackHealth('NSF Awards', 'research', 'live', null, count);
      return { value: count, label: count + ' NSF news items', activity: round(act), channel: 'activity', signal: count + ' NSF research news items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty NSF page');
  } catch (e) {
    return _fetchRSS('NSF grant award OR National Science Foundation announcement OR NSF research funding', 'NSF Awards', 'research', 'activity');
  }
}

async function fetchRetractionWatch() {
  try {
    var xml = await timedText('https://retractionwatch.com/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('Retraction Watch', 'research', 'live', null, count);
      return { value: count, label: count + ' Retraction Watch posts', activity: round(act), channel: 'activity', signal: count + ' research integrity / retraction items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty RSS');
  } catch (e) {
    return _fetchRSS('paper retraction OR research misconduct OR scientific fraud OR data fabrication', 'Retraction Watch', 'research', 'activity');
  }
}

async function fetchNIHGrants() {
  try {
    var xml = await timedText('https://www.nih.gov/news-events/news-releases/feed', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 30, 0.05, 1.0);
      trackHealth('NIH Grants', 'research', 'live', null, count);
      return { value: count, label: count + ' NIH news items', activity: round(act), channel: 'activity', signal: count + ' NIH research news items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty NIH RSS');
  } catch (e) {
    return _fetchRSS('NIH grant OR NIH funding OR National Institutes of Health award OR NIH research', 'NIH Grants', 'research', 'activity');
  }
}

async function fetchNatureScience() {
  try {
    var xml = await timedText('https://www.nature.com/nature.rss', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 30, 0.05, 1.0);
      trackHealth('Nature / Science Press', 'research', 'live', null, count);
      return { value: count, label: count + ' Nature articles', activity: round(act), channel: 'activity', signal: count + ' Nature press items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Nature RSS');
  } catch (e) {
    return _fetchRSS('Nature journal OR Science magazine OR scientific breakthrough OR research publication', 'Nature / Science Press', 'research', 'activity');
  }
}

// ─── EDUCATION EXPANSION ────────────────────────────────────────────────

async function fetchEDGovNews() {
  try {
    var xml = await timedText('https://www.ed.gov/feed', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('ED.gov News', 'education', 'live', null, count);
      return { value: count, label: count + ' ED.gov items', activity: round(act), channel: 'activity', signal: count + ' U.S. Department of Education news items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty ED.gov RSS');
  } catch (e) {
    return _fetchRSS('"Department of Education" OR "ED.gov" OR "Secretary of Education" OR "federal education policy"', 'ED.gov News', 'education', 'activity');
  }
}

async function fetchNCESNews() {
  try {
    var xml = await timedText('https://nces.ed.gov/whatsnew/whatsnew.rss', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('NCES News', 'education', 'live', null, count);
      return { value: count, label: count + ' NCES items', activity: round(act), channel: 'activity', signal: count + ' National Center for Education Statistics releases', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty NCES RSS');
  } catch (e) {
    return _fetchRSS('"National Center for Education Statistics" OR "NCES report" OR "NAEP results" OR "education statistics"', 'NCES News', 'education', 'activity');
  }
}

async function fetchEdWeekNews() {
  try {
    var xml = await timedText('https://www.edweek.org/feed', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 30, 0.05, 1.0);
      trackHealth('EdWeek News', 'education', 'live', null, count);
      return { value: count, label: count + ' EdWeek items', activity: round(act), channel: 'activity', signal: count + ' Education Week news items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty EdWeek RSS');
  } catch (e) {
    return _fetchRSS('"Education Week" OR "teacher shortage" OR "school district" OR "K-12 education"', 'EdWeek News', 'education', 'activity');
  }
}

async function fetchIESNews() {
  try {
    var xml = await timedText('https://ies.ed.gov/whatsnew/whatsnew.rss', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('IES News', 'education', 'live', null, count);
      return { value: count, label: count + ' IES items', activity: round(act), channel: 'activity', signal: count + ' Institute of Education Sciences items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty IES RSS');
  } catch (e) {
    return _fetchRSS('"Institute of Education Sciences" OR "IES research" OR "What Works Clearinghouse" OR "education research"', 'IES News', 'education', 'activity');
  }
}

async function fetchChronicleHigherEd() {
  try {
    var xml = await timedText('https://www.chronicle.com/feed', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 30, 0.05, 1.0);
      trackHealth('Chronicle of Higher Ed', 'education', 'live', null, count);
      return { value: count, label: count + ' Chronicle items', activity: round(act), channel: 'activity', signal: count + ' Chronicle of Higher Education items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Chronicle RSS');
  } catch (e) {
    return _fetchRSS('"Chronicle of Higher Education" OR "university enrollment" OR "college closure" OR "higher education policy"', 'Chronicle of Higher Ed', 'education', 'activity');
  }
}

// ─── TECHNOLOGY EXPANSION ───────────────────────────────────────────────

async function fetchCISAKEV() {
  try {
    var data = await timedJSON('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
    if (!data || !data.vulnerabilities) { trackHealth('CISA KEV', 'technology', 'fallback', 'empty response'); return null; }
    var total = data.vulnerabilities.length;
    var cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    var recent = 0;
    for (var i = 0; i < data.vulnerabilities.length; i++) {
      var dateAdded = data.vulnerabilities[i].dateAdded;
      if (dateAdded && new Date(dateAdded).getTime() >= cutoff) recent++;
    }
    var act = clamp(recent / 30, 0.1, 1.0);
    trackHealth('CISA KEV', 'technology', 'live', null, recent);
    return { value: recent, label: recent + ' new KEV entries (30d) / ' + total + ' total', activity: round(act), channel: 'activity', signal: recent + ' Known Exploited Vulnerabilities added in last 30 days', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) {
    trackHealth('CISA KEV', 'technology', 'fallback', e.message);
    return null;
  }
}

async function fetchNVDRecent() {
  try {
    var today = new Date();
    var start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    var url = 'https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=' + start.toISOString() + '&pubEndDate=' + today.toISOString() + '&resultsPerPage=200';
    var data = await timedJSON(url);
    if (!data || !data.vulnerabilities) { trackHealth('NVD Recent CVEs', 'technology', 'fallback', 'empty response'); return null; }
    var total = data.totalResults || data.vulnerabilities.length;
    var critical = 0;
    for (var i = 0; i < data.vulnerabilities.length; i++) {
      var m = data.vulnerabilities[i].cve && data.vulnerabilities[i].cve.metrics;
      if (!m) continue;
      var cvss = (m.cvssMetricV31 && m.cvssMetricV31[0] && m.cvssMetricV31[0].cvssData) ||
                 (m.cvssMetricV30 && m.cvssMetricV30[0] && m.cvssMetricV30[0].cvssData) ||
                 (m.cvssMetricV2  && m.cvssMetricV2[0]  && m.cvssMetricV2[0].cvssData);
      if (cvss && cvss.baseScore >= 9.0) critical++;
    }
    var act = clamp(total / 300, 0.1, 1.0);
    trackHealth('NVD Recent CVEs', 'technology', 'live', null, total);
    return { value: total, label: total + ' CVEs (7d), ' + critical + ' critical', activity: round(act), channel: 'activity', signal: total + ' new CVEs in last 7 days, ' + critical + ' critical', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) {
    trackHealth('NVD Recent CVEs', 'technology', 'fallback', e.message);
    return null;
  }
}

async function fetchKrebsSecurity() {
  try {
    var xml = await timedText('https://krebsonsecurity.com/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('Krebs Security', 'technology', 'live', null, count);
      return { value: count, label: count + ' Krebs posts', activity: round(act), channel: 'activity', signal: count + ' Krebs on Security investigations', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Krebs RSS');
  } catch (e) {
    return _fetchRSS('ransomware OR "data breach" OR "cyber attack" OR hacker OR exploit', 'Krebs Security', 'technology', 'activity');
  }
}

async function fetchHackerNews() {
  try {
    var ids = await timedJSON('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!ids || !Array.isArray(ids)) { trackHealth('Hacker News', 'technology', 'fallback', 'empty response'); return null; }
    var total = ids.length;
    var act = clamp(total / 500, 0.1, 1.0);
    trackHealth('Hacker News', 'technology', 'live', null, total);
    return { value: total, label: total + ' top stories', activity: round(act), channel: 'activity', signal: total + ' Hacker News top stories (tech discourse intensity)', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) {
    trackHealth('Hacker News', 'technology', 'fallback', e.message);
    return null;
  }
}

async function fetchGitHubSecurityAdvisories() {
  try {
    var xml = await timedText('https://github.blog/category/security/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 15, 0.05, 1.0);
      trackHealth('GitHub Security Advisories', 'technology', 'live', null, count);
      return { value: count, label: count + ' GitHub security posts', activity: round(act), channel: 'activity', signal: count + ' GitHub security advisories / posts', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty GitHub security RSS');
  } catch (e) {
    return _fetchRSS('"GitHub advisory" OR "npm vulnerability" OR "dependency vulnerability" OR "open source security"', 'GitHub Security Advisories', 'technology', 'activity');
  }
}

// ─── COMMUNICATION EXPANSION ────────────────────────────────────────────

async function fetchRSF() {
  try {
    var xml = await timedText('https://rsf.org/en/rss.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 15, 0.05, 1.0);
      trackHealth('Reporters Without Borders', 'communication', 'live', null, count);
      return { value: count, label: count + ' RSF press freedom items', activity: round(act), channel: 'activity', signal: count + ' Reporters Without Borders press freedom alerts', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty RSF RSS');
  } catch (e) {
    return _fetchRSS('"press freedom" OR "journalist arrest" OR "media censorship" OR "Reporters Without Borders"', 'Reporters Without Borders', 'communication', 'activity');
  }
}

async function fetchCPJ() {
  try {
    var xml = await timedText('https://cpj.org/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 15, 0.05, 1.0);
      trackHealth('CPJ Press Freedom', 'communication', 'live', null, count);
      return { value: count, label: count + ' CPJ alerts', activity: round(act), channel: 'activity', signal: count + ' Committee to Protect Journalists alerts', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty CPJ RSS');
  } catch (e) {
    return _fetchRSS('"Committee to Protect Journalists" OR "journalist killed" OR "journalist imprisoned" OR "press freedom violation"', 'CPJ Press Freedom', 'communication', 'activity');
  }
}

async function fetchSnopes() {
  try {
    var xml = await timedText('https://www.snopes.com/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('Snopes Fact Checks', 'communication', 'live', null, count);
      return { value: count, label: count + ' Snopes fact checks', activity: round(act), channel: 'activity', signal: count + ' Snopes fact-check articles', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Snopes RSS');
  } catch (e) {
    return _fetchRSS('Snopes OR "fact check" OR "false claim" OR misinformation', 'Snopes Fact Checks', 'communication', 'activity');
  }
}

async function fetchPoynter() {
  try {
    var xml = await timedText('https://www.poynter.org/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('Poynter Media News', 'communication', 'live', null, count);
      return { value: count, label: count + ' Poynter items', activity: round(act), channel: 'activity', signal: count + ' Poynter Institute media industry items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Poynter RSS');
  } catch (e) {
    return _fetchRSS('Poynter OR "media industry" OR "newsroom layoffs" OR "journalism ethics"', 'Poynter Media News', 'communication', 'activity');
  }
}

async function fetchNiemanLab() {
  try {
    var xml = await timedText('https://www.niemanlab.org/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 15, 0.05, 1.0);
      trackHealth('Nieman Lab', 'communication', 'live', null, count);
      return { value: count, label: count + ' Nieman Lab posts', activity: round(act), channel: 'activity', signal: count + ' Nieman Lab journalism research / industry items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Nieman Lab RSS');
  } catch (e) {
    return _fetchRSS('"Nieman Lab" OR "future of journalism" OR "news subscription" OR "newsroom strategy"', 'Nieman Lab', 'communication', 'activity');
  }
}

// ─── DEFENSE EXPANSION ─ GLOBAL COVERAGE ────────────────────────────────

async function fetchDefenseNews() {
  try {
    var xml = await timedText('https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('Defense News', 'defense', 'live', null, count);
      return { value: count, label: count + ' Defense News items', activity: round(act), channel: 'activity', signal: count + ' Defense News industry items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Defense News RSS');
  } catch (e) {
    return _fetchRSS('"Defense News" OR "Pentagon contract" OR "defense procurement" OR "FMS approval"', 'Defense News', 'defense', 'activity');
  }
}

async function fetchBreakingDefense() {
  try {
    var xml = await timedText('https://breakingdefense.com/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('Breaking Defense', 'defense', 'live', null, count);
      return { value: count, label: count + ' Breaking Defense items', activity: round(act), channel: 'activity', signal: count + ' Breaking Defense industry items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Breaking Defense RSS');
  } catch (e) {
    return _fetchRSS('"Breaking Defense" OR "DoD contract" OR "weapon system" OR "military procurement"', 'Breaking Defense', 'defense', 'activity');
  }
}

async function fetchISW() {
  try {
    var xml = await timedText('https://www.understandingwar.org/rss.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 15, 0.05, 1.0);
      trackHealth('ISW Daily Updates', 'defense', 'live', null, count);
      return { value: count, label: count + ' ISW assessments', activity: round(act), channel: 'activity', signal: count + ' Institute for the Study of War assessments', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty ISW RSS');
  } catch (e) {
    return _fetchRSS('"Institute for the Study of War" OR "ISW" OR "Russia Ukraine assessment" OR "Iran update"', 'ISW Daily Updates', 'defense', 'activity');
  }
}

async function fetchRUSI() {
  try {
    var xml = await timedText('https://www.rusi.org/rss.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 15, 0.05, 1.0);
      trackHealth('RUSI Commentary', 'defense', 'live', null, count);
      return { value: count, label: count + ' RUSI commentaries', activity: round(act), channel: 'activity', signal: count + ' Royal United Services Institute strategic commentary', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty RUSI RSS');
  } catch (e) {
    return _fetchRSS('"Royal United Services Institute" OR RUSI OR "European defence" OR "British military"', 'RUSI Commentary', 'defense', 'activity');
  }
}

async function fetchNATONews() {
  try {
    var xml = await timedText('https://www.nato.int/cps/en/natohq/news.rss', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 15, 0.05, 1.0);
      trackHealth('NATO News', 'defense', 'live', null, count);
      return { value: count, label: count + ' NATO updates', activity: round(act), channel: 'activity', signal: count + ' NATO official news and announcements', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty NATO RSS');
  } catch (e) {
    return _fetchRSS('NATO OR "Article 5" OR "NATO summit" OR "alliance defense" OR "European Defence Fund"', 'NATO News', 'defense', 'activity');
  }
}

async function fetchDefenseOne() {
  try {
    var xml = await timedText('https://www.defenseone.com/rss/all/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('Defense One', 'defense', 'live', null, count);
      return { value: count, label: count + ' Defense One items', activity: round(act), channel: 'activity', signal: count + ' Defense One industry / policy items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Defense One RSS');
  } catch (e) {
    return _fetchRSS('"Defense One" OR "DoD policy" OR "Pentagon strategy" OR "military doctrine"', 'Defense One', 'defense', 'activity');
  }
}

async function fetchTheWarZone() {
  try {
    var xml = await timedText('https://www.twz.com/feed', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('The War Zone', 'defense', 'live', null, count);
      return { value: count, label: count + ' The War Zone items', activity: round(act), channel: 'activity', signal: count + ' The War Zone tactical and military aviation items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty The War Zone RSS');
  } catch (e) {
    return _fetchRSS('"The War Zone" OR "fighter jet" OR "military aviation" OR "naval operation"', 'The War Zone', 'defense', 'activity');
  }
}

async function fetchCSIS() {
  try {
    var xml = await timedText('https://www.csis.org/rss/analysis', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 15, 0.05, 1.0);
      trackHealth('CSIS Analysis', 'defense', 'live', null, count);
      return { value: count, label: count + ' CSIS analyses', activity: round(act), channel: 'activity', signal: count + ' Center for Strategic and International Studies items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty CSIS RSS');
  } catch (e) {
    return _fetchRSS('CSIS OR "Center for Strategic and International Studies" OR "geopolitical analysis"', 'CSIS Analysis', 'defense', 'activity');
  }
}

async function fetchSIPRI() {
  try {
    var xml = await timedText('https://www.sipri.org/rss/news.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 10, 0.05, 1.0);
      trackHealth('SIPRI Arms Trade', 'defense', 'live', null, count);
      return { value: count, label: count + ' SIPRI items', activity: round(act), channel: 'activity', signal: count + ' Stockholm International Peace Research Institute updates', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty SIPRI RSS');
  } catch (e) {
    return _fetchRSS('SIPRI OR "Stockholm International Peace Research" OR "arms transfer" OR "global military expenditure"', 'SIPRI Arms Trade', 'defense', 'activity');
  }
}

// ─── DEFENSE ADVERSARY PERSPECTIVE FEEDS ────────────────────────────────
// State-controlled or state-affiliated news from Russia, China, Iran, and DPRK.
// Treated as POSITIONAL signal (what the adversary wants the world to hear),
// NOT as ground truth. The defense brain weights these differently.

async function fetchTASS() {
  try {
    var xml = await timedText('https://tass.com/rss/all.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 30, 0.05, 1.0);
      trackHealth('TASS (Russia)', 'defense', 'live', null, count);
      return { value: count, label: count + ' TASS items', activity: round(act), channel: 'activity', signal: count + ' TASS Russian state news items (adversary perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty TASS RSS');
  } catch (e) {
    return _fetchRSS('TASS Russia OR "Russian Ministry of Defense" OR Kremlin', 'TASS (Russia)', 'defense', 'activity');
  }
}

async function fetchXinhua() {
  try {
    var xml = await timedText('http://www.xinhuanet.com/english/rss/worldrss.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 30, 0.05, 1.0);
      trackHealth('Xinhua (China)', 'defense', 'live', null, count);
      return { value: count, label: count + ' Xinhua items', activity: round(act), channel: 'activity', signal: count + ' Xinhua Chinese state news items (adversary perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Xinhua RSS');
  } catch (e) {
    return _fetchRSS('Xinhua OR "China Ministry of Defence" OR Beijing OR "PLA Daily"', 'Xinhua (China)', 'defense', 'activity');
  }
}

async function fetchGlobalTimes() {
  try {
    var xml = await timedText('https://www.globaltimes.cn/rss/outbrain.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('Global Times (China)', 'defense', 'live', null, count);
      return { value: count, label: count + ' Global Times items', activity: round(act), channel: 'activity', signal: count + ' Global Times Chinese state-affiliated items (adversary perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Global Times RSS');
  } catch (e) {
    return _fetchRSS('"Global Times" Beijing OR "Hu Xijin" OR "PLA exercise"', 'Global Times (China)', 'defense', 'activity');
  }
}

async function fetchPressTV() {
  try {
    var xml = await timedText('https://www.presstv.ir/rss.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('Press TV (Iran)', 'defense', 'live', null, count);
      return { value: count, label: count + ' Press TV items', activity: round(act), channel: 'activity', signal: count + ' Press TV Iranian state items (adversary perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Press TV RSS');
  } catch (e) {
    return _fetchRSS('"Press TV" Iran OR Tehran OR IRGC OR "Islamic Republic"', 'Press TV (Iran)', 'defense', 'activity');
  }
}

async function fetchKCNAWatch() {
  try {
    var xml = await timedText('https://kcnawatch.org/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 10, 0.05, 1.0);
      trackHealth('KCNA Watch (DPRK)', 'defense', 'live', null, count);
      return { value: count, label: count + ' KCNA items', activity: round(act), channel: 'activity', signal: count + ' KCNA Watch North Korean state news items (adversary perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty KCNA Watch RSS');
  } catch (e) {
    return _fetchRSS('KCNA OR "North Korea" Pyongyang OR "Kim Jong Un" OR "DPRK missile"', 'KCNA Watch (DPRK)', 'defense', 'activity');
  }
}

async function fetchSCMP() {
  try {
    var xml = await timedText('https://www.scmp.com/rss/91/feed', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('South China Morning Post', 'defense', 'live', null, count);
      return { value: count, label: count + ' SCMP items', activity: round(act), channel: 'activity', signal: count + ' SCMP China-focused items (regional perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty SCMP RSS');
  } catch (e) {
    return _fetchRSS('"South China Morning Post" OR Hong Kong OR "PLA exercise" OR "Taiwan Strait"', 'South China Morning Post', 'defense', 'activity');
  }
}

// ─── FINANCE ────────────────────────────────────────────────────────────

async function fetchAlphaVantage() {
  var key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) { trackHealth('Alpha Vantage Market', 'finance', 'fallback', 'ALPHA_VANTAGE_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&apikey=' + key);
    if (!data || !data['Global Quote'] || !data['Global Quote']['05. price']) { trackHealth('Alpha Vantage Market', 'finance', 'fallback', 'empty response'); return null; }
    var price = parseFloat(data['Global Quote']['05. price']);
    var change = parseFloat(data['Global Quote']['10. change percent']) || 0;
    if (isNaN(price)) { trackHealth('Alpha Vantage Market', 'finance', 'fallback', 'non-numeric'); return null; }
    var stress = clamp(Math.abs(change) / 3, 0, 1);
    trackHealth('Alpha Vantage Market', 'finance', 'live', null, price);
    return { value: price, label: 'SPY $' + price.toFixed(2), stress: round(stress), signal: 'S&P 500 ' + (change >= 0 ? '+' : '') + change.toFixed(2) + '%', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Alpha Vantage Market', 'finance', 'fallback', e.message); return null; }
}

async function fetchFinnhub() {
  var key = process.env.FINNHUB_API_KEY;
  if (!key) { trackHealth('Finnhub Market', 'finance', 'fallback', 'FINNHUB_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://finnhub.io/api/v1/quote?symbol=SPY&token=' + key);
    if (!data || !data.c) { trackHealth('Finnhub Market', 'finance', 'fallback', 'empty response'); return null; }
    var price = data.c;
    var pctChange = data.o > 0 ? ((data.c - data.o) / data.o) * 100 : 0;
    var stress = clamp(Math.abs(pctChange) / 3, 0, 1);
    trackHealth('Finnhub Market', 'finance', 'live', null, price);
    return { value: price, label: 'SPY $' + price.toFixed(2), stress: round(stress), signal: 'market move ' + (pctChange >= 0 ? '+' : '') + pctChange.toFixed(2) + '%', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Finnhub Market', 'finance', 'fallback', e.message); return null; }
}

// ─── FINANCE: keyless institutional feeds (.gov / Federal Reserve / SRO) ──
// All 10 are public, keyless, and map to finance-brain diagnoses:
// BANKING_CRISIS, CREDIT_FREEZE, MARKET_CRASH, FRAUD_SCANDAL,
// SYSTEMIC_CONTAGION, CURRENCY_COLLAPSE.

async function fetchSECEDGARCurrent() {
  // SEC EDGAR current filings (Atom). Public; SEC requires UA with contact.
  try {
    var xml = await timedText('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=&output=atom', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0 (research@limenhelix.com)' }
    });
    if (!xml || xml.length < 100) { trackHealth('SEC EDGAR Filings', 'finance', 'fallback', 'empty response'); return null; }
    var entries = (xml.match(/<entry[\s>]/gi) || []).length;
    if (entries === 0) { trackHealth('SEC EDGAR Filings', 'finance', 'fallback', 'no entries'); return null; }
    var act = clamp(entries / 40, 0.05, 1.0);
    trackHealth('SEC EDGAR Filings', 'finance', 'live', null, entries);
    return { value: entries, label: entries + ' EDGAR entries', activity: round(act), channel: 'activity', signal: entries + ' SEC filings in current window', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('SEC EDGAR Filings', 'finance', 'fallback', e.message); return null; }
}

async function fetchTreasuryYieldCurve() {
  // Fiscaldata avg_interest_rates — keyless JSON. Bills-minus-Notes spread is
  // a short-end inversion proxy (positive spread = bills rate > notes rate
  // = yield curve inverted = recession warning).
  try {
    var data = await timedJSON('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page%5Bsize%5D=20', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !data.data || !data.data.length) { trackHealth('Treasury Yield Curve', 'finance', 'fallback', 'empty response'); return null; }
    var billsRate = null, notesRate = null;
    for (var i = 0; i < data.data.length; i++) {
      var d = data.data[i];
      if (d.security_desc === 'Treasury Bills' && billsRate === null) billsRate = parseFloat(d.avg_interest_rate_amt);
      if (d.security_desc === 'Treasury Notes' && notesRate === null) notesRate = parseFloat(d.avg_interest_rate_amt);
    }
    if (billsRate === null || notesRate === null || isNaN(billsRate) || isNaN(notesRate)) {
      trackHealth('Treasury Yield Curve', 'finance', 'fallback', 'missing bills or notes rate');
      return null;
    }
    // Spread: bills minus notes. Positive = inversion (bills > notes).
    var inversion = billsRate - notesRate;
    var stress = inversion > 0 ? clamp(inversion / 1.5, 0, 1) : 0;
    trackHealth('Treasury Yield Curve', 'finance', 'live', null, inversion);
    return { value: inversion, label: 'Bills-Notes ' + inversion.toFixed(2) + 'pp', stress: round(stress), signal: inversion > 0 ? 'yield curve inverted ' + inversion.toFixed(2) + 'pp (bills>notes)' : 'yield curve normal ' + inversion.toFixed(2) + 'pp', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Treasury Yield Curve', 'finance', 'fallback', e.message); return null; }
}

async function fetchTreasuryDebt() {
  // Treasury fiscaldata Debt to the Penny — keyless JSON.
  try {
    var data = await timedJSON('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=1', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !data.data || !data.data[0]) { trackHealth('Treasury Debt', 'finance', 'fallback', 'empty response'); return null; }
    var rec = data.data[0];
    var totalDebt = parseFloat(rec.tot_pub_debt_out_amt);
    if (isNaN(totalDebt)) { trackHealth('Treasury Debt', 'finance', 'fallback', 'non-numeric'); return null; }
    var debtT = totalDebt / 1e12;
    var stress = clamp((debtT - 30) / 15, 0, 1);
    trackHealth('Treasury Debt', 'finance', 'live', null, debtT);
    return { value: debtT, label: 'US debt $' + debtT.toFixed(2) + 'T', stress: round(stress), signal: 'sovereign debt at $' + debtT.toFixed(2) + 'T', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Treasury Debt', 'finance', 'fallback', e.message); return null; }
}

async function fetchFedH41() {
  // Federal Reserve H.4.1 RSS — balance sheet release activity.
  try {
    var xml = await timedText('https://www.federalreserve.gov/feeds/h41.xml', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!xml || xml.length < 100) { trackHealth('Fed H.4.1 Balance Sheet', 'finance', 'fallback', 'empty response'); return null; }
    var items = (xml.match(/<item[\s>]/gi) || []).length;
    if (items === 0) items = (xml.match(/<rdf:li/gi) || []).length;
    if (items === 0) { trackHealth('Fed H.4.1 Balance Sheet', 'finance', 'fallback', 'no items'); return null; }
    var act = clamp(items / 40, 0.05, 1.0);
    trackHealth('Fed H.4.1 Balance Sheet', 'finance', 'live', null, items);
    return { value: items, label: items + ' Fed releases', activity: round(act), channel: 'activity', signal: 'Fed balance sheet release count: ' + items, updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Fed H.4.1 Balance Sheet', 'finance', 'fallback', e.message); return null; }
}

async function fetchFDICBankFailures() {
  // FDIC press releases via GovDelivery RSS — bank failure / enforcement velocity.
  try {
    var xml = await timedText('https://public.govdelivery.com/topics/USFDIC_26/feed.rss', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!xml || xml.length < 100) { trackHealth('FDIC Bank Failures', 'finance', 'fallback', 'empty response'); return null; }
    var items = (xml.match(/<item[\s>]/gi) || []).length;
    if (items === 0) { trackHealth('FDIC Bank Failures', 'finance', 'fallback', 'no items'); return null; }
    var failureMentions = (xml.match(/failure|failed|closing|closed bank|enforcement|consent order|civil money/gi) || []).length;
    var stress = clamp(failureMentions / 8, 0, 1);
    trackHealth('FDIC Bank Failures', 'finance', 'live', null, failureMentions);
    return { value: failureMentions, label: failureMentions + ' FDIC distress signals', stress: round(stress), signal: failureMentions + ' FDIC enforcement / failure mentions', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('FDIC Bank Failures', 'finance', 'fallback', e.message); return null; }
}

async function fetchOCCEnforcement() {
  // OCC news RSS — bank regulatory action volume.
  try {
    var xml = await timedText('https://www.occ.treas.gov/rss/occ_news.xml', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!xml || xml.length < 100) { trackHealth('OCC Enforcement', 'finance', 'fallback', 'empty response'); return null; }
    var items = (xml.match(/<item[\s>]/gi) || []).length;
    if (items === 0) { trackHealth('OCC Enforcement', 'finance', 'fallback', 'no items'); return null; }
    var enforcement = (xml.match(/enforcement|cease|consent|civil money|prohibition|fine|penalty|order/gi) || []).length;
    var stress = clamp(enforcement / 10, 0, 1);
    trackHealth('OCC Enforcement', 'finance', 'live', null, enforcement);
    return { value: enforcement, label: enforcement + ' OCC action signals', stress: round(stress), signal: enforcement + ' bank regulatory action mentions', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('OCC Enforcement', 'finance', 'fallback', e.message); return null; }
}

async function fetchCFTCPress() {
  // CFTC enforcement RSS — RSSENF feed is enforcement-only.
  try {
    var xml = await timedText('https://www.cftc.gov/RSS/RSSENF/rssenf.xml', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!xml || xml.length < 100) {
      // General press release RSS as fallback
      xml = await timedText('https://www.cftc.gov/RSS/RSSGP/rssgp.xml', {
        headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
      });
    }
    if (!xml || xml.length < 100) { trackHealth('CFTC Press', 'finance', 'fallback', 'empty response'); return null; }
    var items = (xml.match(/<item[\s>]/gi) || []).length;
    if (items === 0) { trackHealth('CFTC Press', 'finance', 'fallback', 'no items'); return null; }
    var enforcement = (xml.match(/enforcement|fraud|manipulation|charged|penalty|order|insider|misappropriation/gi) || []).length;
    var stress = clamp(enforcement / 12, 0, 1);
    trackHealth('CFTC Press', 'finance', 'live', null, enforcement);
    return { value: enforcement, label: enforcement + ' CFTC enforcement signals', stress: round(stress), signal: enforcement + ' derivatives enforcement mentions', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('CFTC Press', 'finance', 'fallback', e.message); return null; }
}

async function fetchFINRADisciplinary() {
  // FINRA monthly disciplinary actions RSS — broker-dealer integrity signal.
  try {
    var xml = await timedText('https://www.finra.org/rules-guidance/oversight-enforcement/disciplinary-actions/rss', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!xml || xml.length < 100) { trackHealth('FINRA Disciplinary', 'finance', 'fallback', 'empty response'); return null; }
    var items = (xml.match(/<item[\s>]/gi) || []).length;
    if (items === 0) { trackHealth('FINRA Disciplinary', 'finance', 'fallback', 'no items'); return null; }
    var stress = clamp(items / 18, 0, 1);
    trackHealth('FINRA Disciplinary', 'finance', 'live', null, items);
    return { value: items, label: items + ' FINRA actions', stress: round(stress), signal: items + ' broker-dealer disciplinary entries', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('FINRA Disciplinary', 'finance', 'fallback', e.message); return null; }
}

async function fetchNYFedSOFR() {
  // NY Fed markets API — overnight repo (SOFR) rate. Liquidity signal.
  try {
    var data = await timedJSON('https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !data.refRates || !data.refRates[0]) { trackHealth('NY Fed SOFR', 'finance', 'fallback', 'empty response'); return null; }
    var rate = parseFloat(data.refRates[0].percentRate);
    if (isNaN(rate)) { trackHealth('NY Fed SOFR', 'finance', 'fallback', 'non-numeric'); return null; }
    var stress = clamp((rate - 4.5) / 3, 0, 1);
    trackHealth('NY Fed SOFR', 'finance', 'live', null, rate);
    return { value: rate, label: 'SOFR ' + rate.toFixed(2) + '%', stress: round(stress), signal: 'overnight repo rate ' + rate.toFixed(2) + '%', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('NY Fed SOFR', 'finance', 'fallback', e.message); return null; }
}

async function fetchNCUACreditUnion() {
  // NCUA — no public RSS; scrape press release listing for activity signal.
  try {
    var html = await timedText('https://www.ncua.gov/newsroom/press-releases', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!html || html.length < 200) { trackHealth('NCUA Credit Unions', 'finance', 'fallback', 'empty response'); return null; }
    var rows = (html.match(/views-row|press-release|article[\s>]/gi) || []).length;
    if (rows === 0) { trackHealth('NCUA Credit Unions', 'finance', 'fallback', 'no rows parseable'); return null; }
    var distress = (html.match(/conservatorship|liquidation|merger|cease|enforcement|prohibition|civil money/gi) || []).length;
    var stress = clamp(distress / 6, 0, 1);
    trackHealth('NCUA Credit Unions', 'finance', 'live', null, distress);
    return { value: distress, label: distress + ' credit union actions', stress: round(stress), signal: distress + ' credit union distress mentions', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('NCUA Credit Unions', 'finance', 'fallback', e.message); return null; }
}

// ─── SUPPLY CHAIN: keyless institutional feeds (.gov / NWS / CISA / Treasury) ──
// All 10 are public, keyless, and map to trade-brain.js diagnoses:
// SUPPLY_CHAIN_COLLAPSE, PORT_BLOCKADE, TRADE_WAR, SHIPPING_CRISIS, CUSTOMS_DISRUPTION.
// trade-brain.js carries domainId 'supplyChain' (single brain, both labels).

async function _fetchFedRegAgency(label, slug) {
  // Shared helper for Federal Register API. Counts past-30d docs per agency.
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'supplyChain', 'fallback', 'empty response'); return null; }
    var docs = data.results.length;
    if (docs === 0) { trackHealth(label, 'supplyChain', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'supplyChain', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'supplyChain', 'fallback', e.message); return null; }
}

async function fetchNOAANWSAlerts() {
  // NWS active hazard alerts — keyless JSON. Severe weather → route_constraint, port_closure.
  try {
    var data = await timedJSON('https://api.weather.gov/alerts/active?status=actual', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0', 'Accept': 'application/geo+json' }
    });
    if (!data || !data.features) { trackHealth('NOAA NWS Alerts', 'supplyChain', 'fallback', 'empty response'); return null; }
    var alerts = data.features.length;
    if (alerts === 0) { trackHealth('NOAA NWS Alerts', 'supplyChain', 'fallback', 'no alerts'); return null; }
    var severe = 0, tropical = 0, marine = 0;
    for (var i = 0; i < data.features.length; i++) {
      var p = data.features[i].properties || {};
      var ev = (p.event || '').toLowerCase();
      var sev = (p.severity || '').toLowerCase();
      if (sev === 'extreme' || sev === 'severe') severe++;
      if (ev.indexOf('hurricane') !== -1 || ev.indexOf('tropical') !== -1) tropical++;
      if (ev.indexOf('marine') !== -1 || ev.indexOf('coastal') !== -1 || ev.indexOf('small craft') !== -1) marine++;
    }
    var stress = clamp((severe / 100) + (tropical / 5) + (marine / 30), 0, 1);
    trackHealth('NOAA NWS Alerts', 'supplyChain', 'live', null, alerts);
    return { value: alerts, label: alerts + ' NWS alerts (' + severe + ' severe)', stress: round(stress), signal: alerts + ' active weather alerts (' + severe + ' severe, ' + tropical + ' tropical, ' + marine + ' marine)', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('NOAA NWS Alerts', 'supplyChain', 'fallback', e.message); return null; }
}

async function fetchUSGSEarthquakes() {
  // USGS M4.5+ past 24h — keyless GeoJSON. Sourcing / production disruption signal.
  try {
    var data = await timedJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !data.features) { trackHealth('USGS Earthquakes', 'supplyChain', 'fallback', 'empty response'); return null; }
    var quakes = data.features.length;
    var maxMag = 0, sigCount = 0;
    for (var i = 0; i < data.features.length; i++) {
      var p = data.features[i].properties || {};
      var mag = parseFloat(p.mag) || 0;
      if (mag > maxMag) maxMag = mag;
      if (mag >= 6.0) sigCount++;
    }
    var stress = clamp((quakes / 25) + (sigCount * 0.2) + Math.max(0, maxMag - 5) * 0.15, 0, 1);
    trackHealth('USGS Earthquakes', 'supplyChain', 'live', null, quakes);
    return { value: quakes, label: quakes + ' M4.5+ quakes (max M' + maxMag.toFixed(1) + ')', stress: round(stress), signal: quakes + ' earthquakes M4.5+ in 24h, ' + sigCount + ' M6+, peak M' + maxMag.toFixed(1), updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('USGS Earthquakes', 'supplyChain', 'fallback', e.message); return null; }
}

async function fetchCISAKEV() {
  // CISA Known Exploited Vulnerabilities — keyless JSON. Cyber-physical supply chain signal.
  try {
    var data = await timedJSON('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !data.vulnerabilities) { trackHealth('CISA KEV', 'supplyChain', 'fallback', 'empty response'); return null; }
    var total = data.vulnerabilities.length;
    var recent = 0, ransomware = 0;
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    for (var i = 0; i < data.vulnerabilities.length; i++) {
      var v = data.vulnerabilities[i];
      var added = new Date(v.dateAdded).getTime();
      if (!isNaN(added) && added >= thirtyDaysAgo) recent++;
      if (v.knownRansomwareCampaignUse === 'Known') ransomware++;
    }
    var stress = clamp((recent / 25) + (ransomware / 600), 0, 1);
    trackHealth('CISA KEV', 'supplyChain', 'live', null, recent);
    return { value: recent, label: recent + ' new KEVs (30d)', stress: round(stress), signal: recent + ' newly-exploited CVEs in 30d, ' + ransomware + ' ransomware-active of ' + total + ' total', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('CISA KEV', 'supplyChain', 'fallback', e.message); return null; }
}

async function fetchFedRegCBP()         { return _fetchFedRegAgency('Fed Reg CBP',         'u-s-customs-and-border-protection'); }
async function fetchFedRegCoastGuard()  { return _fetchFedRegAgency('Fed Reg Coast Guard', 'coast-guard'); }
async function fetchFedRegFAA()         { return _fetchFedRegAgency('Fed Reg FAA',         'federal-aviation-administration'); }
async function fetchFedRegNHTSA()       { return _fetchFedRegAgency('Fed Reg NHTSA',       'national-highway-traffic-safety-administration'); }
async function fetchFedRegFMCSA()       { return _fetchFedRegAgency('Fed Reg FMCSA',       'federal-motor-carrier-safety-administration'); }
async function fetchFedRegUSTR()        { return _fetchFedRegAgency('Fed Reg USTR',        'trade-representative-office-of-united-states'); }

async function fetchOFACRecentActions() {
  // OFAC Recent Actions HTML — sanctions activity → trade_restriction / TRADE_WAR.
  try {
    var html = await timedText('https://ofac.treasury.gov/recent-actions', {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    if (!html || html.length < 200) { trackHealth('OFAC Recent Actions', 'supplyChain', 'fallback', 'empty response'); return null; }
    var rows = (html.match(/views-row|recent-actions__item|press-release|<article/gi) || []).length;
    if (rows === 0) { trackHealth('OFAC Recent Actions', 'supplyChain', 'fallback', 'no rows parseable'); return null; }
    var sanctions = (html.match(/sanction|sdn|designation|prohibited|added to the|blocked|secondary sanctions/gi) || []).length;
    var stress = clamp(sanctions / 30, 0, 1);
    trackHealth('OFAC Recent Actions', 'supplyChain', 'live', null, sanctions);
    return { value: sanctions, label: sanctions + ' OFAC action signals', stress: round(stress), signal: sanctions + ' sanctions / SDN designations referenced in recent actions', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('OFAC Recent Actions', 'supplyChain', 'fallback', e.message); return null; }
}

// ─── AGRICULTURE: keyless institutional feeds (USDA / NOAA / FDA / Federal Register / World Bank) ──
// All 10 are public, keyless, and map to agriculture-brain.js diagnoses:
// CASH_FLOW_CRISIS, SUPPLY_CHAIN_BREAKDOWN, DROUGHT, MARKET_COLLAPSE,
// EQUIPMENT_FAILURE, PEST_OUTBREAK.

async function fetchUSDADroughtMonitor() {
  // U.S. Drought Monitor — keyless CSV (statistics by % area in cumulative drought classes).
  // CSV columns: MapDate,AreaOfInterest,None,D0,D1,D2,D3,D4,ValidStart,ValidEnd,StatisticFormatID
  // Columns are CUMULATIVE: D2 column = % area in D2 or worse (D2+D3+D4).
  try {
    var endDate = new Date();
    var startDate = new Date(endDate.getTime() - 14 * 86400000);
    var fmt = function (d) { return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear(); };
    var url = 'https://usdmdataservices.unl.edu/api/USStatistics/GetDroughtSeverityStatisticsByAreaPercent?aoi=us&startdate=' + encodeURIComponent(fmt(startDate)) + '&enddate=' + encodeURIComponent(fmt(endDate)) + '&statisticsType=1';
    var csv = await timedText(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!csv || csv.length < 50) { trackHealth('USDA Drought Monitor', 'agriculture', 'fallback', 'empty response'); return null; }
    var lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) { trackHealth('USDA Drought Monitor', 'agriculture', 'fallback', 'no data rows'); return null; }
    // Latest CONUS row (skip 'Total' which includes territories).
    var latestRow = null;
    for (var i = 1; i < lines.length; i++) {
      var cols = lines[i].split(',');
      if (cols[1] === 'CONUS') { latestRow = cols; break; }
    }
    if (!latestRow) { trackHealth('USDA Drought Monitor', 'agriculture', 'fallback', 'no CONUS row'); return null; }
    var d2plus = parseFloat(latestRow[5]) || 0;
    var d3plus = parseFloat(latestRow[6]) || 0;
    if (isNaN(d2plus)) { trackHealth('USDA Drought Monitor', 'agriculture', 'fallback', 'non-numeric D2'); return null; }
    var stress = clamp(d2plus / 50, 0, 1);
    trackHealth('USDA Drought Monitor', 'agriculture', 'live', null, d2plus);
    return { value: d2plus, label: d2plus.toFixed(1) + '% CONUS in D2+ drought', stress: round(stress), signal: d2plus.toFixed(1) + '% of CONUS in D2-D4 drought, ' + d3plus.toFixed(1) + '% in D3-D4', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('USDA Drought Monitor', 'agriculture', 'fallback', e.message); return null; }
}

async function fetchNOAACPCDrought() {
  // NOAA Climate Prediction Center seasonal drought summary (HTML scrape).
  // Counts mentions of drought intensification language as forward-looking signal.
  try {
    var html = await timedText('https://www.cpc.ncep.noaa.gov/products/expert_assessment/sdo_summary.php', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!html || html.length < 200) { trackHealth('NOAA CPC Drought', 'agriculture', 'fallback', 'empty response'); return null; }
    var intensify = (html.match(/intensif|expand|worsen|persist|develop|emerging|severe drought|extreme drought|exceptional/gi) || []).length;
    var improve = (html.match(/improv|removal|easing|relief|abated|recovery/gi) || []).length;
    var net = intensify - improve;
    var stress = clamp(net / 25, 0, 1);
    trackHealth('NOAA CPC Drought', 'agriculture', 'live', null, net);
    return { value: net, label: 'CPC net drought intensification ' + net, stress: round(stress), signal: 'CPC seasonal outlook: ' + intensify + ' intensification mentions, ' + improve + ' improvement mentions', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('NOAA CPC Drought', 'agriculture', 'fallback', e.message); return null; }
}

async function fetchNOAANWSAgAlerts() {
  // NOAA NWS active alerts re-parsed for agricultural impact (frost, freeze, flood,
  // drought, severe thunderstorm, fire weather). Distinct feed from supplyChain NWS.
  try {
    var data = await timedJSON('https://api.weather.gov/alerts/active?status=actual', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0', 'Accept': 'application/geo+json' }
    });
    if (!data || !data.features) { trackHealth('NOAA NWS Ag Alerts', 'agriculture', 'fallback', 'empty response'); return null; }
    if (data.features.length === 0) { trackHealth('NOAA NWS Ag Alerts', 'agriculture', 'fallback', 'no alerts'); return null; }
    var frost = 0, flood = 0, fire = 0, severe = 0, drought = 0;
    for (var i = 0; i < data.features.length; i++) {
      var ev = (((data.features[i].properties || {}).event) || '').toLowerCase();
      if (ev.indexOf('frost') !== -1 || ev.indexOf('freeze') !== -1) frost++;
      if (ev.indexOf('flood') !== -1) flood++;
      if (ev.indexOf('fire') !== -1 || ev.indexOf('red flag') !== -1) fire++;
      if (ev.indexOf('severe thunderstorm') !== -1 || ev.indexOf('tornado') !== -1 || ev.indexOf('hail') !== -1) severe++;
      if (ev.indexOf('drought') !== -1) drought++;
    }
    var agTotal = frost + flood + fire + severe + drought;
    var stress = clamp((frost / 20) + (flood / 30) + (fire / 15) + (severe / 50) + (drought / 5), 0, 1);
    trackHealth('NOAA NWS Ag Alerts', 'agriculture', 'live', null, agTotal);
    return { value: agTotal, label: agTotal + ' ag-impact alerts', stress: round(stress), signal: agTotal + ' agriculture-impact alerts: ' + frost + ' frost/freeze, ' + flood + ' flood, ' + fire + ' fire, ' + severe + ' severe, ' + drought + ' drought', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('NOAA NWS Ag Alerts', 'agriculture', 'fallback', e.message); return null; }
}

async function fetchFDARecalls() {
  // FDA Recalls / Market Withdrawals / Safety Alerts RSS — biological / supply signal.
  try {
    var xml = await timedText('https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!xml || xml.length < 200) { trackHealth('FDA Recalls', 'agriculture', 'fallback', 'empty response'); return null; }
    var items = (xml.match(/<item[\s>]/gi) || []).length;
    if (items === 0) { trackHealth('FDA Recalls', 'agriculture', 'fallback', 'no items'); return null; }
    var foodborne = (xml.match(/listeria|salmonella|e\.?\s?coli|allergen|undeclared|contamination|pathogen|botulism|foodborne/gi) || []).length;
    var classI   = (xml.match(/class\s+i(?!i)|class i \(/gi) || []).length;
    var stress = clamp((items / 20) + (foodborne / 8) + (classI / 5), 0, 1);
    trackHealth('FDA Recalls', 'agriculture', 'live', null, items);
    return { value: items, label: items + ' FDA recalls', stress: round(stress), signal: items + ' FDA recalls (' + foodborne + ' foodborne pathogen, ' + classI + ' Class I)', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('FDA Recalls', 'agriculture', 'fallback', e.message); return null; }
}

async function _fetchFedRegAgencyAg(label, slug) {
  // Shared Federal Register helper for agriculture domain (mirrors _fetchFedRegAgency).
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'agriculture', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'agriculture', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'agriculture', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'agriculture', 'fallback', e.message); return null; }
}

async function fetchFedRegUSDA()  { return _fetchFedRegAgencyAg('Fed Reg USDA',  'agriculture-department'); }
async function fetchFedRegFDA()   { return _fetchFedRegAgencyAg('Fed Reg FDA',   'food-and-drug-administration'); }
async function fetchFedRegEPA()   { return _fetchFedRegAgencyAg('Fed Reg EPA',   'environmental-protection-agency'); }
async function fetchFedRegAPHIS() { return _fetchFedRegAgencyAg('Fed Reg APHIS', 'animal-and-plant-health-inspection-service'); }
async function fetchFedRegFSIS()  { return _fetchFedRegAgencyAg('Fed Reg FSIS',  'food-safety-and-inspection-service'); }

async function fetchWorldBankFoodIndex() {
  // World Bank Food Production Index (annual). Lagging indicator but stable.
  // Reports % change vs prior period as oversupply / shortage proxy.
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/AG.PRD.FOOD.XD?format=json&per_page=10', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) { trackHealth('World Bank Food Index', 'agriculture', 'fallback', 'empty response'); return null; }
    var rows = data[1].filter(function (r) { return r && r.value !== null; });
    if (rows.length < 2) { trackHealth('World Bank Food Index', 'agriculture', 'fallback', 'insufficient data'); return null; }
    var current = parseFloat(rows[0].value);
    var prior = parseFloat(rows[1].value);
    if (isNaN(current) || isNaN(prior) || prior === 0) { trackHealth('World Bank Food Index', 'agriculture', 'fallback', 'non-numeric'); return null; }
    var pctChange = ((current - prior) / prior) * 100;
    // Stress: large declines (production fell) AND large increases (oversupply) are both signals.
    var stress = clamp(Math.abs(pctChange) / 8, 0, 1);
    trackHealth('World Bank Food Index', 'agriculture', 'live', null, pctChange);
    return { value: pctChange, label: 'Food production ' + (pctChange >= 0 ? '+' : '') + pctChange.toFixed(2) + '% YoY', stress: round(stress), signal: 'US food production index ' + (pctChange >= 0 ? 'up' : 'down') + ' ' + Math.abs(pctChange).toFixed(2) + '% YoY (level: ' + current.toFixed(1) + ')', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('World Bank Food Index', 'agriculture', 'fallback', e.message); return null; }
}

// ─── ECONOMY: keyless institutional feeds (Treasury / Fed / Federal Register / WB / NY Fed) ──
// All 10 are public, keyless, and map to economy-brain.js diagnoses:
// RECESSION, HYPERINFLATION, CREDIT_CHANNEL_BREAK, TARIFF_SHOCK, DEBT_CRISIS, EQUITY_WEALTH_SHOCK.

async function fetchTreasuryMTS() {
  // Treasury MTS Table 1 (receipts/outlays/deficit by month).
  // Pick the latest monthly row with a valid deficit value.
  try {
    var data = await timedJSON('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_1?sort=-record_date&page%5Bsize%5D=20', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !data.data || !data.data.length) { trackHealth('Treasury MTS', 'economy', 'fallback', 'empty response'); return null; }
    // Find row with highest src_line_nbr where record_type_cd === 'MTH' and dfct_sur_amt is valid.
    var best = null;
    var bestLine = -1;
    for (var i = 0; i < data.data.length; i++) {
      var r = data.data[i];
      if (r.record_type_cd !== 'MTH') continue;
      var v = parseFloat(r.current_month_dfct_sur_amt);
      if (isNaN(v) || r.current_month_dfct_sur_amt === 'null') continue;
      var line = parseInt(r.src_line_nbr, 10) || 0;
      if (line > bestLine) { bestLine = line; best = r; }
    }
    if (!best) { trackHealth('Treasury MTS', 'economy', 'fallback', 'no valid monthly row'); return null; }
    var deficitB = parseFloat(best.current_month_dfct_sur_amt) / 1e9;
    var stress = clamp(Math.max(0, deficitB) / 200, 0, 1);
    trackHealth('Treasury MTS', 'economy', 'live', null, deficitB);
    return { value: deficitB, label: 'Fed deficit $' + deficitB.toFixed(1) + 'B (' + (best.classification_desc || '') + ')', stress: round(stress), signal: 'federal monthly deficit $' + deficitB.toFixed(1) + 'B for ' + (best.classification_desc || 'latest') + ' FY' + (best.record_fiscal_year || 'n/a'), updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Treasury MTS', 'economy', 'fallback', e.message); return null; }
}

async function fetchTreasuryOperatingCash() {
  // Treasury Operating Cash Balance — TGA balance.
  // close_today_bal can be "null" string; fall back to open_today_bal.
  try {
    var data = await timedJSON('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date&page%5Bsize%5D=10', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !data.data || !data.data.length) { trackHealth('Treasury Cash Balance', 'economy', 'fallback', 'empty response'); return null; }
    // Only use TGA opening balance row (account_type contains 'TGA' and 'Opening').
    var tgaRow = null;
    for (var i = 0; i < data.data.length; i++) {
      var r = data.data[i];
      var acct = (r.account_type || '').toLowerCase();
      if (acct.indexOf('tga') !== -1 && acct.indexOf('opening') !== -1) { tgaRow = r; break; }
    }
    if (!tgaRow) tgaRow = data.data[0];
    var raw = (tgaRow.close_today_bal && tgaRow.close_today_bal !== 'null') ? tgaRow.close_today_bal : tgaRow.open_today_bal;
    var balance = parseFloat(raw);
    if (isNaN(balance)) { trackHealth('Treasury Cash Balance', 'economy', 'fallback', 'non-numeric'); return null; }
    var balanceB = balance / 1000; // values are in $M; convert to $B
    var stress = clamp((500 - balanceB) / 500, 0, 1);
    trackHealth('Treasury Cash Balance', 'economy', 'live', null, balanceB);
    return { value: balanceB, label: 'TGA cash $' + balanceB.toFixed(1) + 'B', stress: round(stress), signal: 'Treasury operating cash balance $' + balanceB.toFixed(1) + 'B (record: ' + (tgaRow.record_date || 'n/a') + ')', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Treasury Cash Balance', 'economy', 'fallback', e.message); return null; }
}

async function fetchTreasuryDebtOutstanding() {
  // Treasury Debt Outstanding (annual). Field debt_outstanding_amt is in raw dollars.
  try {
    var data = await timedJSON('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_outstanding?sort=-record_date&page%5Bsize%5D=10', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !data.data || !data.data.length) { trackHealth('Treasury Debt Outstanding', 'economy', 'fallback', 'empty response'); return null; }
    var latest = data.data[0];
    var totalDebt = parseFloat(latest.debt_outstanding_amt);
    if (isNaN(totalDebt)) { trackHealth('Treasury Debt Outstanding', 'economy', 'fallback', 'non-numeric'); return null; }
    var debtT = totalDebt / 1e12; // raw dollars → trillions
    var stress = clamp((debtT - 30) / 15, 0, 1);
    trackHealth('Treasury Debt Outstanding', 'economy', 'live', null, debtT);
    return { value: debtT, label: 'US debt $' + debtT.toFixed(2) + 'T', stress: round(stress), signal: 'total US debt outstanding $' + debtT.toFixed(2) + 'T (FY' + (latest.record_fiscal_year || 'n/a') + ')', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Treasury Debt Outstanding', 'economy', 'fallback', e.message); return null; }
}

async function fetchFedMonetaryPress() {
  // Federal Reserve monetary press releases RSS (FOMC + monetary policy actions).
  try {
    var xml = await timedText('https://www.federalreserve.gov/feeds/press_monetary.xml', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!xml || xml.length < 200) { trackHealth('Fed Monetary Press', 'economy', 'fallback', 'empty response'); return null; }
    var items = (xml.match(/<item[\s>]/gi) || []).length;
    if (items === 0) { trackHealth('Fed Monetary Press', 'economy', 'fallback', 'no items'); return null; }
    var tightening = (xml.match(/raise|increase|hike|tighten|hawkish|restrictive/gi) || []).length;
    var easing     = (xml.match(/cut|lower|reduce|ease|dovish|accommodative/gi) || []).length;
    var net = tightening - easing;
    var stress = clamp(Math.abs(net) / 10, 0, 1);
    trackHealth('Fed Monetary Press', 'economy', 'live', null, net);
    return { value: net, label: 'Fed bias ' + (net > 0 ? 'hawkish ' : net < 0 ? 'dovish ' : 'neutral ') + net, stress: round(stress), signal: items + ' Fed monetary releases (' + tightening + ' hawkish, ' + easing + ' dovish)', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Fed Monetary Press', 'economy', 'fallback', e.message); return null; }
}

async function _fetchFedRegAgencyEcon(label, slug) {
  // Shared Federal Register helper for economy domain.
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'economy', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'economy', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'economy', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'economy', 'fallback', e.message); return null; }
}

async function fetchFedRegFedReserve() { return _fetchFedRegAgencyEcon('Fed Reg Fed Reserve', 'federal-reserve-system'); }
async function fetchFedRegTreasury()   { return _fetchFedRegAgencyEcon('Fed Reg Treasury',    'treasury-department'); }
async function fetchFedRegIRS()        { return _fetchFedRegAgencyEcon('Fed Reg IRS',         'internal-revenue-service'); }

async function fetchNYFedEFFR() {
  // NY Fed effective federal funds rate (EFFR) — keyless JSON. Credit cost level.
  try {
    var data = await timedJSON('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !data.refRates || !data.refRates[0]) { trackHealth('NY Fed EFFR', 'economy', 'fallback', 'empty response'); return null; }
    var rate = parseFloat(data.refRates[0].percentRate);
    if (isNaN(rate)) { trackHealth('NY Fed EFFR', 'economy', 'fallback', 'non-numeric'); return null; }
    // Stress increases as policy rate climbs (above 5% = restrictive).
    var stress = clamp((rate - 4.5) / 3, 0, 1);
    trackHealth('NY Fed EFFR', 'economy', 'live', null, rate);
    return { value: rate, label: 'EFFR ' + rate.toFixed(2) + '%', stress: round(stress), signal: 'effective federal funds rate ' + rate.toFixed(2) + '%', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('NY Fed EFFR', 'economy', 'fallback', e.message); return null; }
}

async function fetchWorldBankGDPGrowth() {
  // World Bank US GDP growth (annual %). Lagging recession signal.
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=10', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) { trackHealth('World Bank GDP Growth', 'economy', 'fallback', 'empty response'); return null; }
    var rows = data[1].filter(function (r) { return r && r.value !== null; });
    if (rows.length < 1) { trackHealth('World Bank GDP Growth', 'economy', 'fallback', 'no data'); return null; }
    var growth = parseFloat(rows[0].value);
    if (isNaN(growth)) { trackHealth('World Bank GDP Growth', 'economy', 'fallback', 'non-numeric'); return null; }
    // Stress: growth < 1% triggers; growth < 0 = recession.
    var stress = clamp((2 - growth) / 4, 0, 1);
    trackHealth('World Bank GDP Growth', 'economy', 'live', null, growth);
    return { value: growth, label: 'US GDP ' + (growth >= 0 ? '+' : '') + growth.toFixed(2) + '%', stress: round(stress), signal: 'US GDP growth ' + growth.toFixed(2) + '% YoY (year ' + rows[0].date + ')', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('World Bank GDP Growth', 'economy', 'fallback', e.message); return null; }
}

async function fetchWorldBankInflation() {
  // World Bank US CPI inflation (annual %). Sticky-CPI reference.
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/FP.CPI.TOTL.ZG?format=json&per_page=10', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) { trackHealth('World Bank Inflation', 'economy', 'fallback', 'empty response'); return null; }
    var rows = data[1].filter(function (r) { return r && r.value !== null; });
    if (rows.length < 1) { trackHealth('World Bank Inflation', 'economy', 'fallback', 'no data'); return null; }
    var infl = parseFloat(rows[0].value);
    if (isNaN(infl)) { trackHealth('World Bank Inflation', 'economy', 'fallback', 'non-numeric'); return null; }
    // Stress: > 2% (Fed target) triggers; > 4% = sticky.
    var stress = clamp((infl - 2) / 4, 0, 1);
    trackHealth('World Bank Inflation', 'economy', 'live', null, infl);
    return { value: infl, label: 'US CPI ' + infl.toFixed(2) + '% YoY', stress: round(stress), signal: 'US CPI inflation ' + infl.toFixed(2) + '% YoY (year ' + rows[0].date + ')', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('World Bank Inflation', 'economy', 'fallback', e.message); return null; }
}

// ─── INDUSTRY: keyless Federal Register feeds (OSHA / MSHA / BIS / DOL) ──
// Map to industry-brain.js diagnoses: AUTOMATION_FAILURE, TOXIC_SPILL,
// QUALITY_CRISIS, WORKFORCE_SHORTAGE, INDUSTRIAL_INPUT_FAILURE.

async function _fetchFedRegAgencyInd(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'industry', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'industry', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'industry', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'industry', 'fallback', e.message); return null; }
}

async function fetchFedRegOSHA() { return _fetchFedRegAgencyInd('Fed Reg OSHA', 'occupational-safety-and-health-administration'); }
async function fetchFedRegMSHA() { return _fetchFedRegAgencyInd('Fed Reg MSHA', 'mine-safety-and-health-administration'); }
async function fetchFedRegBIS()  { return _fetchFedRegAgencyInd('Fed Reg BIS',  'industry-and-security-bureau'); }
async function fetchFedRegDOL()  { return _fetchFedRegAgencyInd('Fed Reg DOL',  'labor-department'); }

// ─── INFRASTRUCTURE: keyless feeds (Federal Register + CISA Advisories) ──
// Map to infrastructure-brain.js diagnoses: GRID_DEGRADATION, SUPPLY_CHAIN_BOTTLENECK,
// CAPACITY_OVERLOAD, INFRA_FUNDING_COLLAPSE, MAINTENANCE_DEFICIT, CYBER_PHYSICAL_ATTACK.

async function _fetchFedRegAgencyInfra(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'infrastructure', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'infrastructure', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'infrastructure', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'infrastructure', 'fallback', e.message); return null; }
}

async function fetchFedRegFERC()      { return _fetchFedRegAgencyInfra('Fed Reg FERC',       'federal-energy-regulatory-commission'); }
async function fetchFedRegDHS()       { return _fetchFedRegAgencyInfra('Fed Reg DHS',        'homeland-security-department'); }
async function fetchFedRegDOT()       { return _fetchFedRegAgencyInfra('Fed Reg DOT',        'transportation-department'); }
async function fetchFedRegHUD()       { return _fetchFedRegAgencyInfra('Fed Reg HUD',        'housing-and-urban-development-department'); }
async function fetchFedRegArmyCorps() { return _fetchFedRegAgencyInfra('Fed Reg Army Corps', 'engineers-corps'); }

// ─── ENERGY: keyless Federal Register feeds (DOE / NRC) ──
// Map to energy-brain.js diagnoses: NUCLEAR_INCIDENT, SYSTEMIC_ENERGY_STRESS,
// GRID_COLLAPSE.

async function _fetchFedRegAgencyEnergy(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'energy', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'energy', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'energy', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'energy', 'fallback', e.message); return null; }
}

async function fetchFedRegDOE() { return _fetchFedRegAgencyEnergy('Fed Reg DOE', 'energy-department'); }
async function fetchFedRegNRC() { return _fetchFedRegAgencyEnergy('Fed Reg NRC', 'nuclear-regulatory-commission'); }

// ─── DEFENSE: keyless Federal Register feeds (DoD / State) ──
// Map to defense-brain.js diagnoses: INVASION, NUCLEAR_THREAT, INTEL_COMPROMISE,
// LOGISTICS_COLLAPSE, CIVIL_UNREST. Fed Reg DHS already wired for infrastructure (v226).

async function _fetchFedRegAgencyDef(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'defense', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'defense', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'defense', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'defense', 'fallback', e.message); return null; }
}

async function fetchFedRegDoD()      { return _fetchFedRegAgencyDef('Fed Reg DoD',   'defense-department'); }
async function fetchFedRegStateDept(){ return _fetchFedRegAgencyDef('Fed Reg State', 'state-department'); }

// ─── INTELLIGENCE: keyless Federal Register feeds (FBI / CIA / NSA) ──
// Map to intelligence-brain.js diagnoses: CYBER_ESPIONAGE, MASS_SURVEILLANCE_SCANDAL,
// FOREIGN_INTERFERENCE, INTELLIGENCE_FAILURE.

async function _fetchFedRegAgencyIntel(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'intelligence', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'intelligence', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'intelligence', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'intelligence', 'fallback', e.message); return null; }
}

async function fetchFedRegFBI() { return _fetchFedRegAgencyIntel('Fed Reg FBI', 'federal-bureau-of-investigation'); }
async function fetchFedRegCIA() { return _fetchFedRegAgencyIntel('Fed Reg CIA', 'central-intelligence-agency'); }
async function fetchFedRegNSA() { return _fetchFedRegAgencyIntel('Fed Reg NSA', 'national-security-agency-central-security-service'); }

// ─── GOVERNANCE: keyless Federal Register feed (Executive Office of the President) ──
// Maps to governance-brain.js diagnoses: POLICY_FAILURE, CONSTITUTIONAL_CRISIS.

async function _fetchFedRegAgencyGov(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'governance', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'governance', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'governance', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'governance', 'fallback', e.message); return null; }
}

async function fetchFedRegEOP() { return _fetchFedRegAgencyGov('Fed Reg EOP', 'executive-office-of-the-president'); }

// ─── ENVIRONMENT: keyless Federal Register feed (Interior Department) ──
// Maps to environment-brain.js diagnoses: DEFORESTATION, MASS_EXTINCTION.

async function _fetchFedRegAgencyEnv(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'environment', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'environment', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'environment', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'environment', 'fallback', e.message); return null; }
}

async function fetchFedRegInterior() { return _fetchFedRegAgencyEnv('Fed Reg Interior', 'interior-department'); }

// ─── MEDICINE: keyless Federal Register feeds (HHS / CDC / CMS / NIH) ──
// Maps to medicine-brain.js (snapshotKey 'health') diagnoses:
// CARE_ACCESS_FAILURE, CHRONIC_DISEASE_LOAD, CLINICAL_COORDINATION_BREAKDOWN,
// THERAPEUTIC_RELIABILITY_RISK.

async function _fetchFedRegAgencyHealth(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'health', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'health', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'health', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'health', 'fallback', e.message); return null; }
}

async function fetchFedRegHHS() { return _fetchFedRegAgencyHealth('Fed Reg HHS', 'health-and-human-services-department'); }
async function fetchFedRegCDC() { return _fetchFedRegAgencyHealth('Fed Reg CDC', 'centers-for-disease-control-and-prevention'); }
async function fetchFedRegCMS() { return _fetchFedRegAgencyHealth('Fed Reg CMS', 'centers-for-medicare-medicaid-services'); }
async function fetchFedRegNIH() { return _fetchFedRegAgencyHealth('Fed Reg NIH', 'national-institutes-of-health'); }

// ─── RESEARCH: keyless feeds (Federal Register + World Bank R&D) ──
// Maps to science-brain.js (domainId 'research') diagnoses:
// REPLICATION_CRISIS, FUNDING_COLLAPSE, DATA_FRAUD, PARADIGM_CONFLICT,
// BRAIN_DRAIN, PUBLICATION_BIAS.

async function _fetchFedRegAgencyResearch(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'research', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'research', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'research', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'research', 'fallback', e.message); return null; }
}

async function fetchFedRegNSF()         { return _fetchFedRegAgencyResearch('Fed Reg NSF',        'national-science-foundation'); }
async function fetchFedRegEducation()   { return _fetchFedRegAgencyResearch('Fed Reg Education',  'education-department'); }
async function fetchFedRegNASA()        { return _fetchFedRegAgencyResearch('Fed Reg NASA',       'national-aeronautics-and-space-administration'); }
async function fetchFedRegSmithsonian() { return _fetchFedRegAgencyResearch('Fed Reg Smithsonian','smithsonian-institution'); }

// ─── TECHNOLOGY: keyless Federal Register feeds (FCC / NIST / FTC) ──
// Maps to technology-brain.js diagnoses: PLATFORM_MONOPOLY, AI_ALIGNMENT_FAILURE,
// CYBER_ATTACK, INFRASTRUCTURE_COLLAPSE.

async function _fetchFedRegAgencyTech(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'technology', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'technology', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'technology', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'technology', 'fallback', e.message); return null; }
}

async function fetchFedRegFCC()  { return _fetchFedRegAgencyTech('Fed Reg FCC',  'federal-communications-commission'); }
async function fetchFedRegNIST() { return _fetchFedRegAgencyTech('Fed Reg NIST', 'national-institute-of-standards-and-technology'); }
async function fetchFedRegFTC()  { return _fetchFedRegAgencyTech('Fed Reg FTC',  'federal-trade-commission'); }

// ─── EDUCATION: keyless World Bank tertiary attainment ──
// Maps to education-brain.js: ACHIEVEMENT_GAP, ACCREDITATION_FAILURE.

// ─── POPULATION: keyless feeds (WB Fertility Rate + Census/SSA Federal Register) ──
// Maps to population-brain.js diagnoses: POPULATION_COLLAPSE, AGING_CRISIS,
// MASS_MIGRATION, PANDEMIC_DEMOGRAPHIC_SHOCK.

async function _fetchFedRegAgencyPop(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'population', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'population', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'population', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'population', 'fallback', e.message); return null; }
}

async function fetchFedRegCensus() { return _fetchFedRegAgencyPop('Fed Reg Census', 'census-bureau'); }
async function fetchFedRegSSA()    { return _fetchFedRegAgencyPop('Fed Reg SSA',    'social-security-administration'); }

// ─── LAW: keyless Federal Register feeds (DOJ / DEA / Bureau of Prisons) ──
// Maps to law-brain.js diagnoses: REGULATORY_CAPTURE, MASS_INCARCERATION,
// CONSTITUTIONAL_VIOLATION, INTERNATIONAL_LAW_BREAKDOWN.

async function _fetchFedRegAgencyLaw(label, slug) {
  try {
    var url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(slug);
    var data = await timedJSON(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    if (!data || !data.results) { trackHealth(label, 'law', 'fallback', 'empty response'); return null; }
    if (data.results.length === 0) { trackHealth(label, 'law', 'fallback', 'no recent documents'); return null; }
    var thirtyDaysAgo = Date.now() - 30 * 86400000;
    var recent = 0;
    for (var i = 0; i < data.results.length; i++) {
      var d = data.results[i];
      var pub = new Date(d.publication_date).getTime();
      if (!isNaN(pub) && pub >= thirtyDaysAgo) recent++;
    }
    var stress = clamp(recent / 12, 0, 1);
    trackHealth(label, 'law', 'live', null, recent);
    var shortLabel = label.replace('Fed Reg ', '');
    return { value: recent, label: recent + ' ' + shortLabel + ' docs (30d)', stress: round(stress), signal: recent + ' Federal Register documents from ' + shortLabel + ' in past 30d', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth(label, 'law', 'fallback', e.message); return null; }
}

async function fetchFedRegDOJ()        { return _fetchFedRegAgencyLaw('Fed Reg DOJ',        'justice-department'); }
async function fetchFedRegDEA()        { return _fetchFedRegAgencyLaw('Fed Reg DEA',        'drug-enforcement-administration'); }
async function fetchFedRegBOP()        { return _fetchFedRegAgencyLaw('Fed Reg BOP',        'prisons-bureau'); }

// ─── CLEANUP REPLACEMENTS for key-gated dead slots ──
// Fed Reg PTO replaces USPTO Patents (v8) in research domain.
// BBC World News replaces NewsAPI Headlines (v24) in communication domain.

async function fetchFedRegPTO() {
  // Reuses _fetchFedRegAgencyResearch helper (tracks under 'research' domain).
  return _fetchFedRegAgencyResearch('Fed Reg PTO', 'patent-and-trademark-office');
}

async function fetchBBCWorldNews() {
  // BBC World News RSS — keyless, distinct from Google News keyword search.
  // Provides editorial-curated international news volume signal.
  try {
    var xml = await timedText('https://feeds.bbci.co.uk/news/world/rss.xml', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!xml || xml.length < 200) { trackHealth('BBC World News', 'communication', 'fallback', 'empty response'); return null; }
    var items = (xml.match(/<item[\s>]/gi) || []).length;
    if (items === 0) { trackHealth('BBC World News', 'communication', 'fallback', 'no items'); return null; }
    var stress = clamp(items / 30, 0.05, 0.85);
    trackHealth('BBC World News', 'communication', 'live', null, items);
    return { value: items, label: items + ' BBC World items', stress: round(stress), signal: items + ' BBC World News items', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('BBC World News', 'communication', 'fallback', e.message); return null; }
}

async function fetchWorldBankFertility() {
  // World Bank Fertility Rate, total (births per woman). Annual indicator.
  // Below 2.1 = below replacement; below 1.8 = significant fertility decline;
  // below 1.5 = "ultra-low" demographic-collapse trajectory.
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/SP.DYN.TFRT.IN?format=json&per_page=10', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) { trackHealth('World Bank Fertility', 'population', 'fallback', 'empty response'); return null; }
    var rows = data[1].filter(function (r) { return r && r.value !== null; });
    if (rows.length < 2) { trackHealth('World Bank Fertility', 'population', 'fallback', 'no data'); return null; }
    var current = parseFloat(rows[0].value);
    var prior   = parseFloat(rows[1].value);
    if (isNaN(current)) { trackHealth('World Bank Fertility', 'population', 'fallback', 'non-numeric'); return null; }
    // Stress: below replacement rate (2.1) → fertility decline; lower = more stress.
    // Stress 0 at TFR ≥ 2.1; stress 1 at TFR ≤ 1.4.
    var stress = clamp((2.1 - current) / 0.7, 0, 1);
    trackHealth('World Bank Fertility', 'population', 'live', null, current);
    var deltaPct = !isNaN(prior) && prior > 0 ? ((current - prior) / prior) * 100 : 0;
    return { value: current, label: 'TFR ' + current.toFixed(2) + ' (year ' + rows[0].date + ')', stress: round(stress), signal: 'US total fertility rate ' + current.toFixed(2) + ' births/woman (' + rows[0].date + ', ' + (deltaPct >= 0 ? '+' : '') + deltaPct.toFixed(1) + '% YoY)', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('World Bank Fertility', 'population', 'fallback', e.message); return null; }
}

async function fetchWorldBankTertiary() {
  // World Bank School enrollment, tertiary (% gross). Annual indicator.
  // Lower = access stress; declining = institutional decline.
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/SE.TER.ENRR?format=json&per_page=10', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) { trackHealth('World Bank Tertiary', 'education', 'fallback', 'empty response'); return null; }
    var rows = data[1].filter(function (r) { return r && r.value !== null; });
    if (rows.length < 1) { trackHealth('World Bank Tertiary', 'education', 'fallback', 'no data'); return null; }
    var pct = parseFloat(rows[0].value);
    if (isNaN(pct)) { trackHealth('World Bank Tertiary', 'education', 'fallback', 'non-numeric'); return null; }
    // Stress: below 80% gross enrollment ratio = access stress; below 70% = decline.
    var stress = clamp((85 - pct) / 20, 0, 1);
    trackHealth('World Bank Tertiary', 'education', 'live', null, pct);
    return { value: pct, label: 'US tertiary enrollment ' + pct.toFixed(1) + '% gross (year ' + rows[0].date + ')', stress: round(stress), signal: 'US gross tertiary enrollment ratio ' + pct.toFixed(1) + '% (' + rows[0].date + ')', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('World Bank Tertiary', 'education', 'fallback', e.message); return null; }
}

async function fetchWorldBankRD() {
  // World Bank R&D expenditure (% of GDP). Annual indicator.
  // Lower = funding constraint stress; higher = healthy R&D base.
  try {
    var data = await timedJSON('https://api.worldbank.org/v2/country/USA/indicator/GB.XPD.RSDV.GD.ZS?format=json&per_page=10', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!data || !Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) { trackHealth('World Bank R&D', 'research', 'fallback', 'empty response'); return null; }
    var rows = data[1].filter(function (r) { return r && r.value !== null; });
    if (rows.length < 1) { trackHealth('World Bank R&D', 'research', 'fallback', 'no data'); return null; }
    var pct = parseFloat(rows[0].value);
    if (isNaN(pct)) { trackHealth('World Bank R&D', 'research', 'fallback', 'non-numeric'); return null; }
    // Stress: <2.5% R&D/GDP → funding stress; >3.5% healthy
    var stress = clamp((3.0 - pct) / 1.5, 0, 1);
    trackHealth('World Bank R&D', 'research', 'live', null, pct);
    return { value: pct, label: 'US R&D ' + pct.toFixed(2) + '% GDP (year ' + rows[0].date + ')', stress: round(stress), signal: 'US research and development expenditure ' + pct.toFixed(2) + '% of GDP (' + rows[0].date + ')', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('World Bank R&D', 'research', 'fallback', e.message); return null; }
}

async function fetchCISAAdvisories() {
  // CISA cybersecurity advisories XML — keyless. Counts active advisories.
  try {
    var xml = await timedText('https://www.cisa.gov/cybersecurity-advisories/all.xml', {
      headers: { 'User-Agent': 'LIMEN-Helix/1.0' }
    });
    if (!xml || xml.length < 200) { trackHealth('CISA Advisories', 'infrastructure', 'fallback', 'empty response'); return null; }
    var items = (xml.match(/<item[\s>]/gi) || []).length;
    if (items === 0) items = (xml.match(/<entry[\s>]/gi) || []).length;
    if (items === 0) { trackHealth('CISA Advisories', 'infrastructure', 'fallback', 'no items'); return null; }
    var ics    = (xml.match(/ics-cert|industrial control|scada|operational technology|\bot\b/gi) || []).length;
    var critical = (xml.match(/critical|severe|emergency|exploit|active exploitation|ransomware/gi) || []).length;
    var stress = clamp((items / 60) + (ics / 15) + (critical / 30), 0, 1);
    trackHealth('CISA Advisories', 'infrastructure', 'live', null, items);
    return { value: items, label: items + ' CISA advisories (' + ics + ' ICS/OT)', stress: round(stress), signal: items + ' CISA cybersecurity advisories total, ' + ics + ' ICS/SCADA/OT-specific, ' + critical + ' critical-severity mentions', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('CISA Advisories', 'infrastructure', 'fallback', e.message); return null; }
}

// ─── INTELLIGENCE ───────────────────────────────────────────────────────

async function fetchGDELTIntel() {
  return _fetchGDELT('GDELT Events', 'intelligence', 'intelligence%20surveillance%20cyber');
}

async function fetchTavily() {
  var key = process.env.TAVILY_API_KEY;
  if (!key) { trackHealth('Tavily Search', 'intelligence', 'fallback', 'TAVILY_API_KEY not set'); return null; }
  try {
    var data = await timedJSON('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: key, query: 'global security intelligence threats today', max_results: 5 }) });
    if (!data || !data.results) { trackHealth('Tavily Search', 'intelligence', 'fallback', 'empty response'); return null; }
    var count = data.results.length;
    var act = clamp(count / 10, 0, 1);
    trackHealth('Tavily Search', 'intelligence', 'live', null, count);
    return { value: count, label: count + ' intel results', activity: round(act), channel: 'activity', signal: count + ' threat intelligence items', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Tavily Search', 'intelligence', 'fallback', e.message); return null; }
}

// ─── Shared helpers ─────────────────────────────────────────────────────

/** Extract first non-null value from World Bank v2 response [meta, data[]] */
function _extractWorldBankValue(data) {
  if (!data || !Array.isArray(data) || data.length < 2) return null;
  var arr = data[1];
  if (!Array.isArray(arr)) return null;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] && arr[i].value !== null && arr[i].value !== undefined) {
      return arr[i].value;
    }
  }
  return null;
}

/**
 * Lightweight keyword sentiment — fallback when GDELT tone is missing.
 * Returns a value in [-1, +1] range (negative = negative sentiment).
 */
function _computeFallbackSentiment(title, description) {
  var text = ((title || '') + ' ' + (description || '')).toLowerCase();
  if (!text.trim()) return 0;

  var negWords = ['crisis','war','attack','kill','dead','death','threat','disaster',
    'collapse','fear','panic','crash','conflict','violence','bomb','terror',
    'recession','drought','famine','epidemic','surge','devastat','catastroph',
    'alarm','danger','destruct','fail','worse','scandal','toxic','emergen'];
  var posWords = ['peace','grow','growth','recover','agreement','success','improve',
    'relief','stable','cooperat','aid','boost','gain','hope','prosper','innovat',
    'breakthrough','resolv','progress','support','safe','secure','heal','thrive'];

  var score = 0;
  for (var i = 0; i < negWords.length; i++) {
    if (text.indexOf(negWords[i]) !== -1) score -= 1;
  }
  for (var i = 0; i < posWords.length; i++) {
    if (text.indexOf(posWords[i]) !== -1) score += 1;
  }
  // Clamp to [-1, +1]
  return clamp(score / 3, -1, 1);
}

/**
 * Convert a tone value (GDELT range approx -100..+100) to stress (0..1).
 * Negative tone → higher stress, positive tone → lower stress.
 */
function _toneToStress(tone) {
  // GDELT tone typically ranges -10..+10 but can be wider.
  // Clamp to -100..+100 then map: -100 → 1.0 stress, +100 → 0.0 stress
  var clamped = clamp(tone, -100, 100);
  return round(clamp((100 - clamped) / 200, 0, 1));
}

/**
 * Validate a numeric value is usable (not null, undefined, NaN, or Infinity).
 */
function _isValidNumber(v) {
  return v !== null && v !== undefined && typeof v === 'number' && isFinite(v);
}

/**
 * Shared GDELT v2 DOC API fetcher — uses ToneChart for sentiment-based stress.
 * Fallback chain: ToneChart tone → keyword sentiment → neutral baseline.
 * Never allows NaN to propagate into stress values.
 */
async function _fetchGDELT(sourceName, domain, queryTerms) {
  var log = { source: sourceName, domain: domain, articles: 0, withTone: 0, fallbackUsed: 0, finalStress: null };

  try {
    // Primary: ToneChart mode for reliable tone data
    var data = await timedJSON('https://api.gdeltproject.org/api/v2/doc/doc?query=' + queryTerms + '&mode=ToneChart&format=json');

    // ToneChart returns an array of tone timeline entries
    var toneEntries = null;
    if (data && Array.isArray(data)) {
      toneEntries = data;
    } else if (data && data.timeline && Array.isArray(data.timeline)) {
      toneEntries = data.timeline;
    } else if (data && data.tonechart && Array.isArray(data.tonechart)) {
      toneEntries = data.tonechart;
    }

    if (toneEntries && toneEntries.length > 0) {
      // Extract tone values from entries
      var toneSum = 0;
      var toneCount = 0;
      var articleCount = 0;
      for (var i = 0; i < toneEntries.length; i++) {
        var entry = toneEntries[i];
        var entryTone = entry.tone !== undefined ? entry.tone : (entry.bin !== undefined ? entry.bin : (entry.value !== undefined ? entry.value : (entry.y !== undefined ? entry.y : null)));
        var entryCount = (typeof entry.count === 'number' && entry.count > 0) ? entry.count : (Array.isArray(entry.toparts) ? entry.toparts.length : 1);
        articleCount += entryCount;

        if (_isValidNumber(entryTone) && entryCount > 0) {
          toneSum += entryTone * entryCount; // weighted by article count
          toneCount += entryCount;
        }
      }

      log.articles = articleCount || toneEntries.length;

      if (toneCount > 0) {
        var avgTone = toneSum / toneCount;
        log.withTone = toneCount;
        var stress = _toneToStress(avgTone);

        // Final NaN guard
        if (!_isValidNumber(stress)) {
          stress = 0.5;
          log.fallbackUsed++;
        }

        log.finalStress = stress;
        console.log('[GDELT] ' + JSON.stringify(log));
        trackHealth(sourceName, domain, 'live', null, log.articles);
        return { value: round(avgTone), label: 'tone ' + round(avgTone) + ' (' + log.articles + ' articles)', stress: stress, signal: domain + ' media tone: ' + round(avgTone), updated: Date.now(), fetchedAt: Date.now() };
      }
    }

    // Fallback: try ArtList for title/description-based sentiment
    var artData = await timedJSON('https://api.gdeltproject.org/api/v2/doc/doc?query=' + queryTerms + '&mode=ArtList&maxrecords=5&format=json');
    if (artData && artData.articles && Array.isArray(artData.articles) && artData.articles.length > 0) {
      var articles = artData.articles;
      log.articles = articles.length;
      var sentSum = 0;
      var sentCount = 0;

      for (var j = 0; j < articles.length; j++) {
        var art = articles[j];
        // Check if article has a usable tone field
        if (_isValidNumber(art.tone)) {
          sentSum += art.tone;
          sentCount++;
          log.withTone++;
        } else {
          // Compute from title/description
          var fallbackScore = _computeFallbackSentiment(art.title, art.seendate || art.url);
          // Scale keyword sentiment (-1..+1) to tone-like range (-10..+10)
          sentSum += fallbackScore * 10;
          sentCount++;
          log.fallbackUsed++;
        }
      }

      if (sentCount > 0) {
        var avgSent = sentSum / sentCount;
        var stress = _toneToStress(avgSent);

        if (!_isValidNumber(stress)) {
          stress = 0.5;
          log.fallbackUsed++;
        }

        log.finalStress = stress;
        console.log('[GDELT] ' + JSON.stringify(log));
        trackHealth(sourceName, domain, 'live', null, log.articles);
        return { value: round(avgSent), label: 'sentiment ' + round(avgSent) + ' (' + log.articles + ' articles)', stress: stress, signal: domain + ' media sentiment: ' + round(avgSent), updated: Date.now(), fetchedAt: Date.now() };
      }
    }

    // No usable data from either endpoint
    log.finalStress = null;
    console.log('[GDELT] ' + JSON.stringify(log));
    trackHealth(sourceName, domain, 'fallback', 'no tone or articles returned');
    return null;

  } catch (e) {
    log.finalStress = null;
    // On 429 (rate limit), do NOT retry or make fallback ArtList request
    if (e.statusCode === 429) {
      console.log('[GDELT] RATE LIMITED ' + sourceName + ' — skipping fallback | ' + JSON.stringify(log));
      trackHealth(sourceName, domain, 'rate_limited', 'HTTP 429 — rate limited');
      return null;
    }
    console.log('[GDELT] ERROR ' + sourceName + ': ' + e.message + ' | ' + JSON.stringify(log));
    trackHealth(sourceName, domain, 'fallback', e.message);
    return null;
  }
}

// ─── RSS-BASED SOURCE REPLACEMENTS (replaces broken GDELT/ACLED) ────────
// Simple, reliable, zero-auth. Google News RSS keyword counting.

var RSS_TIMEOUT = 3000;

// Phase 22: RSS feeds are classified by channel.
// Defense/supplyChain/energy RSS = stress drivers (keyword-specific crisis detection).
// All other RSS = activity indicators (volume/pace only).
async function _fetchRSS(query, sourceName, domain, channel) {
  channel = channel || 'activity'; // default: activity indicator
  try {
    var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en';
    var controller = new AbortController();
    var tid = setTimeout(function() { controller.abort(); }, RSS_TIMEOUT);
    var resp = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    clearTimeout(tid);
    var xml = await resp.text();
    var count = (xml.match(/<item>/gi) || []).length;

    // Capture the actual REAL headlines (not just a count) so the Signals dropdown shows
    // what's really going on in the world, and changes as the news changes (refreshed every
    // snapshot cron). Google News RSS item titles are "Headline - Publisher".
    // Also capture each item's <link> so the public front can send a reader to the ACTUAL
    // article instead of showing an unattributable headline string. headlineLinks[] is
    // index-aligned with headlines[]; an item with no parseable link holds null, never a
    // guessed URL. Google News RSS links are news.google.com redirects to the publisher.
    var headlines = [], headlineLinks = [];
    var _items = xml.split(/<item>/i).slice(1);
    // AFFERENT TRANSDUCTION (2026-07-28). The receptor reads RECENT DENSITY, not raw
    // count — see the norm computation below for why. Ages are collected on this same
    // pass over the items, so the change costs zero extra fetches and zero extra parses
    // of the document; <pubDate> is already present on every item Google returns
    // (verified live: 100 items, 100 pubDates).
    var _now = Date.now(), _ages = [];
    for (var _hi = 0; _hi < _items.length; _hi++) {
      var _pm = _items[_hi].match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      if (_pm) {
        var _pt = Date.parse(_pm[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
        if (!isNaN(_pt)) _ages.push((_now - _pt) / 86400000); // age in days
      }
      if (headlines.length >= 5) continue;   // headlines capped at 5; dates are not
      var _tm = _items[_hi].match(/<title>([\s\S]*?)<\/title>/i);
      if (!_tm) continue;
      var _t = _tm[1].replace(/<!\[CDATA\[|\]\]>/g, '')
                     .replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&#x27;/gi, "'")
                     .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      if (!_t) continue;
      var _lm = _items[_hi].match(/<link>([\s\S]*?)<\/link>/i);
      var _l = _lm ? _lm[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim() : '';
      headlines.push(_t);
      headlineLinks.push(/^https?:\/\//i.test(_l) ? _l : null);
    }

    // ── THE RECEPTOR ──────────────────────────────────────────────────────
    // WAS: norm = count / 100. Google News RSS pages at exactly 100 items, so any
    // query with 100+ indexed articles reported 1.0 forever. Measured live 2026-07-28:
    // 89 of 275 sources (32.4%) pinned at exactly 100, religion 15/15 — ONE distinct
    // value across its entire afferent surface. Across a 24-source sample, raw count
    // produced 4 distinct values (21 at the ceiling); 7-day density produced 18,
    // spanning the full 0..100 range. The denominator stays 100 because that is still
    // the page size: norm is "how much of a full page is from the last 7 days", which
    // is bounded 0..1 by construction and needs no invented scale factor.
    // A source with no parseable dates falls back to the old count behaviour rather
    // than reporting 0, so a feed that omits pubDate degrades instead of going dark.
    var _recent7d = 0, _recent1d = 0, _recent30d = 0;
    for (var _ai = 0; _ai < _ages.length; _ai++) {
      if (_ages[_ai] <= 1) _recent1d++;
      if (_ages[_ai] <= 7) _recent7d++;
      if (_ages[_ai] <= 30) _recent30d++;
    }
    var _medianAge = null;
    if (_ages.length) {
      var _sorted = _ages.slice().sort(function(a, b) { return a - b; });
      _medianAge = Math.round(_sorted[Math.floor(_sorted.length / 2)] * 10) / 10;
    }
    var _dated = _ages.length > 0;
    var norm = _dated ? clamp(_recent7d / 100, 0, 1) : clamp(count / 100, 0, 1);
    var _topSignal = headlines.length
      ? (headlines[0] + (count > 1 ? '  (+' + (count - 1) + ' more)' : ''))
      : (count + ' news articles on ' + domain);
    var _topUrl = headlineLinks.length ? headlineLinks[0] : null;

    trackHealth(sourceName, domain, 'live', null, count);

    // Diagnostic fields carried on every RSS source. articleCount is the raw page
    // size the receptor USED to publish — kept so the saturation this fix removes
    // stays measurable, and so a reviewer can tell a genuinely quiet feed (low
    // count) from a dead one (high count, high medianAgeDays). medianAgeDays is the
    // dead-source detector: measured live 2026-07-28, Pew Religion 312d, USCIRF 129d
    // and Orthodox Christianity 117d were all reporting the ceiling.
    var _meta = {
      articleCount: count, recent1d: _recent1d, recent7d: _recent7d,
      recent30d: _recent30d, medianAgeDays: _medianAge, dated: _dated
    };

    if (channel === 'stress') {
      // Stress driver: crisis keyword RSS. Scale by domain sensitivity.
      // Note: _isRss:true marks these as RSS-derived for the global classifier;
      // they are demoted to DEGRADED (activity bucket) regardless of this channel.
      var STRESS_SCALE = { defense: 30, supplyChain: 35, energy: 35 };
      var scale = STRESS_SCALE[domain] || 50;
      var stress = clamp((_dated ? _recent7d : count) / scale, 0.05, 0.85);
      // `activity` is set here too, and that is the bug fix, not a spare field.
      // _classifyFeed marks every _isRss source EVENT, and the EVENT branch routes
      // any non-context source into activitySources — including these, whose channel
      // is 'stress'. The activity mean then adds `data.activity || 0`, so before this
      // line each stress-channel RSS source injected a hard ZERO into its domain's
      // activity average. Measured live 2026-07-28: energy (11 such sources, no other
      // activity source) published activity exactly 0, as did industry, infrastructure,
      // supplyChain and agriculture; religion read 0.33 = 0.99 x 5/15. Every domain
      // with no RSS-stress sources sat at 0.70-0.83. Volume is well defined for these
      // feeds, so they now contribute it instead of a zero.
      return { value: count, label: count + ' articles', stress: round(stress), activity: round(norm), channel: 'stress', signal: _topSignal, signalUrl: _topUrl, headlines: headlines, headlineLinks: headlineLinks, updated: Date.now(), fetchedAt: Date.now(), _isRss: true, _meta: _meta };
    }
    // Activity indicator: volume only, does not drive stress
    return { value: count, label: count + ' articles', activity: round(norm), channel: 'activity', signal: _topSignal, signalUrl: _topUrl, headlines: headlines, headlineLinks: headlineLinks, updated: Date.now(), fetchedAt: Date.now(), _isRss: true, _meta: _meta };
  } catch (e) {
    trackHealth(sourceName, domain, 'fallback', e.message || 'RSS fetch failed');
    return null;
  }
}

// Defense RSS = stress drivers (crisis keyword detection)
async function fetchRSSDefense() {
  return _fetchRSS('military attack OR missile OR airstrike OR defense escalation', 'RSS Defense Signals', 'defense', 'stress');
}
async function fetchRSSConflict() {
  return _fetchRSS('conflict OR war OR invasion OR armed forces deployed', 'RSS Defense Conflict', 'defense', 'stress');
}
// Religion RSS = activity only (volume, not crisis)
async function fetchRSSReligion() {
  return _fetchRSS('religious conflict OR sectarian OR interfaith OR religious persecution', 'RSS Religion News', 'religion', 'activity');
}
async function fetchRSSReligionEvents() {
  return _fetchRSS('religious community OR faith leaders OR church OR mosque OR temple OR religious observance', 'RSS Religion Events', 'religion', 'activity');
}
async function fetchRSSGovernance() {
  return _fetchRSS('government policy OR political crisis OR institutional reform OR sanctions', 'RSS Governance', 'governance');
}
async function fetchRSSMedia() {
  return _fetchRSS('media censorship OR press freedom OR disinformation OR social media regulation', 'RSS Media', 'communication');
}
async function fetchRSSCulture() {
  return _fetchRSS('cultural event OR arts funding OR heritage OR social movement', 'RSS Culture', 'culture');
}
async function fetchRSSIntel() {
  return _fetchRSS('intelligence report OR espionage OR cyber espionage OR surveillance OR national security', 'RSS Intel Signals', 'intelligence');
}

// ─── INTELLIGENCE DOMAIN DEEP FEEDS ─────────────────────────────────────

async function fetchRecordedFutureIntel() {
  return _fetchRSS('"Recorded Future" OR "threat intelligence" OR "nation-state APT" OR "cyber threat actor"', 'Recorded Future Intel', 'intelligence', 'stress');
}
async function fetchCISAAlerts() {
  return _fetchRSS('CISA alert OR CISA advisory OR "cybersecurity advisory" OR "known exploited vulnerability"', 'CISA Advisories', 'intelligence', 'stress');
}
async function fetchNSACybersecurityAdvisories() {
  return _fetchRSS('NSA cybersecurity OR "NSA advisory" OR "NSA Cybersecurity Directorate" OR "joint cybersecurity advisory"', 'NSA Cybersecurity Advisories', 'intelligence', 'stress');
}
async function fetchFBICyberDiv() {
  return _fetchRSS('FBI cyber OR "FBI flash alert" OR "FBI IC3" OR "FBI cyber division" OR "FBI PIN"', 'FBI Cyber Division', 'intelligence', 'stress');
}
async function fetchDNIAnnualThreat() {
  return _fetchRSS('ODNI OR "Director of National Intelligence" OR "Annual Threat Assessment" OR "Worldwide Threat"', 'DNI Annual Threat', 'intelligence', 'stress');
}
async function fetchCyberScoopNews() {
  return _fetchRSS('CyberScoop OR "national security cyber" OR "intelligence community cyber" OR "federal cybersecurity"', 'CyberScoop News', 'intelligence', 'stress');
}
async function fetchTheRecord() {
  return _fetchRSS('"The Record" Recorded Future OR "cyber espionage" OR "nation-state hack" OR "intelligence agency cyber"', 'The Record', 'intelligence', 'stress');
}
async function fetchLawfareNatSec() {
  return _fetchRSS('Lawfare OR "national security law" OR FISA OR "surveillance law" OR "intelligence oversight"', 'Lawfare NatSec', 'intelligence', 'activity');
}
// Asymmetric sources — activity channel only, cannot independently fire high-stress
async function fetchBellingcatOSINT() {
  return _fetchRSS('Bellingcat OR "open source investigation" OR "geolocation investigation" OR "OSINT investigation"', 'Bellingcat OSINT', 'intelligence', 'activity');
}
async function fetchInterceptNatSec() {
  return _fetchRSS('"The Intercept" national security OR surveillance OR "intelligence community" OR whistleblower', 'The Intercept NatSec', 'intelligence', 'activity');
}

// ─── MASSIVE/POLYGON REAL-TIME MARKET DATA ──────────────────────────────

async function fetchMassiveCrudeOil() {
  var key = process.env.MASSIVE_API_KEY;
  if (!key) { trackHealth('Massive Crude Oil', 'energy', 'fallback', 'MASSIVE_API_KEY not set'); return null; }
  try {
    var controller = new AbortController();
    var tid = setTimeout(function() { controller.abort(); }, 4000);
    var resp = await fetch('https://api.polygon.io/v2/aggs/ticker/CL/prev?adjusted=true&apiKey=' + key, { signal: controller.signal });
    clearTimeout(tid);
    var data = await resp.json();
    if (!data || data.status !== 'OK' || !data.results || !data.results[0]) {
      trackHealth('Massive Crude Oil', 'energy', 'fallback', 'no results'); return null;
    }
    var r = data.results[0];
    var price = r.c; // close price
    // Stress: crude above $80 = elevated, above $100 = high
    var stress = clamp((price - 60) / 50, 0, 1);
    trackHealth('Massive Crude Oil', 'energy', 'live', null, price);
    return { value: price, label: 'crude $' + price.toFixed(2), stress: round(stress), signal: 'crude oil $' + price.toFixed(2) + '/bbl', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Massive Crude Oil', 'energy', 'fallback', e.message); return null; }
}

async function fetchMassiveSPY() {
  var key = process.env.MASSIVE_API_KEY;
  if (!key) { trackHealth('Massive SPY', 'finance', 'fallback', 'MASSIVE_API_KEY not set'); return null; }
  try {
    var controller = new AbortController();
    var tid = setTimeout(function() { controller.abort(); }, 4000);
    var resp = await fetch('https://api.polygon.io/v2/aggs/ticker/SPY/prev?adjusted=true&apiKey=' + key, { signal: controller.signal });
    clearTimeout(tid);
    var data = await resp.json();
    if (!data || data.status !== 'OK' || !data.results || !data.results[0]) {
      trackHealth('Massive SPY', 'finance', 'fallback', 'no results'); return null;
    }
    var r = data.results[0];
    var change = ((r.c - r.o) / r.o) * 100;
    // Stress: bigger daily drop = higher stress. >2% drop = high stress
    var stress = clamp(Math.abs(Math.min(change, 0)) / 3, 0, 1);
    trackHealth('Massive SPY', 'finance', 'live', null, r.c);
    return { value: r.c, label: 'SPY $' + r.c.toFixed(2) + ' (' + (change >= 0 ? '+' : '') + change.toFixed(2) + '%)', stress: round(stress), signal: 'S&P500 ' + (change >= 0 ? '+' : '') + change.toFixed(2) + '%', updated: Date.now(), fetchedAt: Date.now() };
  } catch (e) { trackHealth('Massive SPY', 'finance', 'fallback', e.message); return null; }
}

async function fetchRSSSupplyChain() {
  return _fetchRSS('shipping disruption OR port congestion OR freight rates OR supply chain crisis OR container shortage OR logistics delay', 'RSS Supply Chain', 'supplyChain', 'stress');
}

async function fetchRSSAgriculture() {
  return _fetchRSS('food price OR crop failure OR fertilizer shortage OR grain export OR food insecurity OR agricultural crisis', 'RSS Agriculture', 'agriculture', 'stress');
}

// ─── ENVIRONMENT — INSTITUTIONALLY STRONG SOURCES ────────────────────────
// EPA, NOAA, USGS, Global Forest Watch, IUCN are institutional sources
// that can independently raise environment stress. Inside Climate News and
// Grist are directional / advocacy-aligned and are rendered as activity-
// channel signals only — they cannot independently fire high-stress diagnoses.

async function fetchEPANews() {
  return _fetchRSS('EPA enforcement OR Superfund OR PFAS OR clean water act OR clean air act OR environmental violation OR emissions rule', 'EPA News', 'environment', 'stress');
}
async function fetchNOAAResearch() {
  return _fetchRSS('NOAA climate OR ocean heat OR coral bleaching OR sea level rise OR marine heatwave OR climate change research', 'NOAA Research', 'environment', 'stress');
}
async function fetchUSGSNews() {
  return _fetchRSS('USGS water OR groundwater depletion OR aquifer OR drought OR earthquake OR volcanic OR landslide OR streamflow', 'USGS News', 'environment', 'stress');
}
async function fetchGlobalForestWatchNews() {
  return _fetchRSS('deforestation alert OR forest loss OR primary forest OR illegal logging OR Amazon OR Congo Basin OR tropical forest', 'Global Forest Watch', 'environment', 'stress');
}
async function fetchIUCNNews() {
  return _fetchRSS('IUCN Red List OR endangered species OR biodiversity loss OR extinction OR species decline OR habitat loss', 'IUCN Red List', 'environment', 'stress');
}
// Inside Climate News and Grist are asymmetric (advocacy-leaning) — activity channel only.
// Per the environment-source rule, directional signals cannot alone fire high-stress
// diagnoses. High stress requires corroborating institutional / scientific sources.
async function fetchInsideClimateNews() {
  return _fetchRSS('climate change OR fossil fuel OR climate policy OR environmental justice OR climate litigation', 'Inside Climate News', 'environment', 'activity');
}
async function fetchGristEnv() {
  return _fetchRSS('climate emergency OR environmental crisis OR sustainability OR green jobs OR climate activism', 'Grist Environment', 'environment', 'activity');
}

// ─── ENERGY — ADDITIONAL INSTITUTIONAL SOURCES ───────────────────────────
// EIA, IEA, and OPEC are institutional sources that can independently
// raise energy stress. These supplement the primary crude oil price feeds
// with weekly supply/demand, natural gas, electricity, and OPEC basket data.

async function fetchEIAWeeklyPetroleum() {
  return _fetchRSS('EIA petroleum OR weekly petroleum status OR crude oil inventory OR gasoline inventory OR strategic petroleum reserve OR refinery utilization', 'EIA Weekly Petroleum Status', 'energy', 'stress');
}
async function fetchEIANaturalGas() {
  return _fetchRSS('EIA natural gas OR Henry Hub OR natural gas storage OR LNG export OR natural gas production OR pipeline capacity', 'EIA Natural Gas Weekly', 'energy', 'stress');
}
async function fetchEIAElectricity() {
  return _fetchRSS('EIA electricity OR power grid OR electricity generation OR renewable capacity OR coal retirement OR grid reliability', 'EIA Electricity Monthly', 'energy', 'stress');
}
async function fetchIEANews() {
  return _fetchRSS('IEA energy OR International Energy Agency OR world energy outlook OR oil market report OR energy transition OR energy security', 'IEA Energy News', 'energy', 'stress');
}
async function fetchOPECBasket() {
  return _fetchRSS('OPEC basket OR OPEC production cut OR OPEC+ output OR OPEC meeting OR oil supply OR oil demand OR barrel production', 'OPEC Reference Basket', 'energy', 'stress');
}
async function fetchSolarIndustryNews() {
  return _fetchRSS('solar energy OR solar panel OR photovoltaic OR SEIA OR solar installation OR utility-scale solar OR rooftop solar OR solar tariff OR solar ITC', 'Solar Industry News', 'energy', 'stress');
}
async function fetchWindEnergyNews() {
  return _fetchRSS('wind energy OR offshore wind OR onshore wind OR wind turbine OR wind farm OR AWEA OR wind power capacity OR wind PPA', 'Wind Energy News', 'energy', 'stress');
}
async function fetchNuclearEnergyNews() {
  return _fetchRSS('nuclear energy OR nuclear power OR nuclear reactor OR SMR small modular reactor OR nuclear fuel OR uranium enrichment OR nuclear plant OR NRC nuclear', 'Nuclear Energy News', 'energy', 'stress');
}
async function fetchHydrogenEnergyNews() {
  return _fetchRSS('hydrogen energy OR green hydrogen OR blue hydrogen OR electrolyzer OR fuel cell OR hydrogen hub OR hydrogen pipeline OR hydrogen production', 'Hydrogen Economy News', 'energy', 'stress');
}
async function fetchGridReliabilityNews() {
  return _fetchRSS('grid reliability OR NERC OR FERC OR ISO OR RTO OR blackout OR grid emergency OR interconnection queue OR transmission OR grid congestion', 'Grid Reliability (FERC/NERC)', 'energy', 'stress');
}
async function fetchEnergyStorageNews() {
  return _fetchRSS('energy storage OR battery storage OR lithium-ion OR grid-scale battery OR BESS OR pumped hydro OR flow battery OR Tesla Megapack OR storage deployment', 'Energy Storage News', 'energy', 'stress');
}
async function fetchLNGMarketNews() {
  return _fetchRSS('LNG market OR liquefied natural gas OR LNG terminal OR LNG export OR LNG carrier OR LNG spot price OR regasification OR floating LNG', 'LNG Market News', 'energy', 'stress');
}
async function fetchCoalTransitionNews() {
  return _fetchRSS('coal retirement OR coal plant closure OR coal transition OR just transition coal OR coal phase-out OR coal mine OR thermal coal OR coal generation', 'Coal Transition News', 'energy', 'stress');
}

// ─── INDUSTRY — INSTITUTIONALLY STRONG SOURCES ───────────────────────────
// NHTSA, CPSC, PHMSA, CSB are institutional sources that can independently
// raise industry stress. UAW / USW strike tracker is an institutional labor
// activity signal tied to structural workforce stress.

async function fetchNHTSARecalls() {
  return _fetchRSS('NHTSA recall OR vehicle recall OR automotive defect OR airbag recall OR brake recall OR steering recall', 'NHTSA Recalls', 'industry', 'stress');
}
async function fetchCPSCRecalls() {
  return _fetchRSS('CPSC recall OR consumer product recall OR product safety OR CPSC warning OR hazardous product', 'CPSC Recalls', 'industry', 'stress');
}
async function fetchPHMSAIncidents() {
  return _fetchRSS('pipeline incident OR hazmat incident OR rail derailment OR pipeline leak OR chemical release OR PHMSA', 'PHMSA Incidents', 'industry', 'stress');
}
async function fetchCSBInvestigations() {
  return _fetchRSS('CSB investigation OR chemical plant OR refinery explosion OR industrial fire OR process safety OR OSHA PSM', 'CSB Investigations', 'industry', 'stress');
}
async function fetchUAWStrikeTracker() {
  return _fetchRSS('UAW strike OR USW strike OR Teamsters strike OR work stoppage OR labor walkout OR industrial strike OR picket line', 'UAW Strike Tracker', 'industry', 'stress');
}

// ─── GOVERNANCE — INSTITUTIONALLY STRONG SOURCES ─────────────────────────
// Oversight, congressional, fiscal, regulatory, and research feeds. These can
// independently raise governance stress because they are non-partisan or
// rules-bound institutional voices.

async function fetchGovTrack() {
  try {
    var xml = await timedText('https://www.govtrack.us/events/events.rss?feeds=misc:activebills2', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 30, 0.05, 1.0);
      trackHealth('GovTrack', 'governance', 'live', null, count);
      return { value: count, label: count + ' GovTrack legislative events', activity: round(act), channel: 'activity', signal: count + ' GovTrack legislative events', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty GovTrack RSS');
  } catch (e) {
    return _fetchRSS('"GovTrack" OR "House bill" OR "Senate vote" OR "legislation introduced"', 'GovTrack', 'governance', 'activity');
  }
}

async function fetchCongressGov() {
  try {
    var xml = await timedText('https://www.congress.gov/rss/most-viewed-bills.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('Congress.gov', 'governance', 'live', null, count);
      return { value: count, label: count + ' Congress.gov bills', activity: round(act), channel: 'activity', signal: count + ' Congress.gov most-viewed bills', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Congress.gov RSS');
  } catch (e) {
    return _fetchRSS('"Congress.gov" OR "House passes" OR "Senate passes" OR "committee markup"', 'Congress.gov', 'governance', 'activity');
  }
}

async function fetchGAOReports() {
  try {
    var xml = await timedText('https://www.gao.gov/rss/reports.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('GAO Reports', 'governance', 'live', null, count);
      return { value: count, label: count + ' GAO reports', activity: round(act), channel: 'activity', signal: count + ' Government Accountability Office reports', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty GAO RSS');
  } catch (e) {
    return _fetchRSS('"Government Accountability Office" OR "GAO report" OR "GAO finds" OR "GAO recommends"', 'GAO Reports', 'governance', 'activity');
  }
}

async function fetchCBOPublications() {
  try {
    var xml = await timedText('https://www.cbo.gov/publications/all/rss.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 15, 0.05, 1.0);
      trackHealth('CBO Publications', 'governance', 'live', null, count);
      return { value: count, label: count + ' CBO publications', activity: round(act), channel: 'activity', signal: count + ' Congressional Budget Office publications', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty CBO RSS');
  } catch (e) {
    return _fetchRSS('"Congressional Budget Office" OR "CBO projects" OR "CBO baseline" OR "CBO score"', 'CBO Publications', 'governance', 'activity');
  }
}

async function fetchOMBReleases() {
  try {
    var xml = await timedText('https://www.whitehouse.gov/omb/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 15, 0.05, 1.0);
      trackHealth('OMB Releases', 'governance', 'live', null, count);
      return { value: count, label: count + ' OMB releases', activity: round(act), channel: 'activity', signal: count + ' Office of Management and Budget releases', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty OMB RSS');
  } catch (e) {
    return _fetchRSS('"Office of Management and Budget" OR "OMB issues" OR "OMB memorandum" OR "Statement of Administration Policy"', 'OMB Releases', 'governance', 'activity');
  }
}

async function fetchBrennanCenter() {
  try {
    var xml = await timedText('https://www.brennancenter.org/rss.xml', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('Brennan Center', 'governance', 'live', null, count);
      return { value: count, label: count + ' Brennan Center items', activity: round(act), channel: 'activity', signal: count + ' Brennan Center for Justice items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Brennan Center RSS');
  } catch (e) {
    return _fetchRSS('"Brennan Center" OR "voting rights" OR "election integrity" OR "campaign finance reform"', 'Brennan Center', 'governance', 'activity');
  }
}

async function fetchPOGO() {
  try {
    var xml = await timedText('https://www.pogo.org/feed', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('POGO', 'governance', 'live', null, count);
      return { value: count, label: count + ' POGO investigations', activity: round(act), channel: 'activity', signal: count + ' Project on Government Oversight items', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty POGO RSS');
  } catch (e) {
    return _fetchRSS('"Project on Government Oversight" OR POGO OR "government waste" OR "federal contractor abuse"', 'POGO', 'governance', 'activity');
  }
}

// ─── GOVERNANCE — PARTISAN PERSPECTIVE FEEDS ─────────────────────────────
// Politically aligned outlets. Treated as POSITIONAL signal (what one side
// of the spectrum WANTS the public to hear), NOT confirmation of fact. The
// governance brain raises only LOW-WEIGHT directional conditions from these,
// never the high-stress flags. High-stress diagnoses must still be corroborated
// by institutionally stronger sources (GAO, CBO, IGs, World Bank, mainstream).

async function fetchMotherJones() {
  try {
    var xml = await timedText('https://www.motherjones.com/politics/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('Mother Jones', 'governance', 'live', null, count);
      return { value: count, label: count + ' Mother Jones items', activity: round(act), channel: 'activity', signal: count + ' Mother Jones political items (partisan-left perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Mother Jones RSS');
  } catch (e) {
    return _fetchRSS('"Mother Jones" politics OR investigation OR Democrats', 'Mother Jones', 'governance', 'activity');
  }
}

async function fetchHuffPostPolitics() {
  try {
    var xml = await timedText('https://www.huffpost.com/section/politics/feed', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('HuffPost Politics', 'governance', 'live', null, count);
      return { value: count, label: count + ' HuffPost Politics items', activity: round(act), channel: 'activity', signal: count + ' HuffPost political items (partisan-left perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty HuffPost RSS');
  } catch (e) {
    return _fetchRSS('"HuffPost" politics OR Democrats OR progressive', 'HuffPost Politics', 'governance', 'activity');
  }
}

async function fetchTheNation() {
  try {
    var xml = await timedText('https://www.thenation.com/feed/?post_type=article', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 20, 0.05, 1.0);
      trackHealth('The Nation', 'governance', 'live', null, count);
      return { value: count, label: count + ' The Nation items', activity: round(act), channel: 'activity', signal: count + ' The Nation political items (partisan-left perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty The Nation RSS');
  } catch (e) {
    return _fetchRSS('"The Nation" magazine politics OR progressive OR labor', 'The Nation', 'governance', 'activity');
  }
}

async function fetchBreitbart() {
  try {
    var xml = await timedText('https://feeds.feedburner.com/breitbart', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 30, 0.05, 1.0);
      trackHealth('Breitbart', 'governance', 'live', null, count);
      return { value: count, label: count + ' Breitbart items', activity: round(act), channel: 'activity', signal: count + ' Breitbart items (partisan-right perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Breitbart RSS');
  } catch (e) {
    return _fetchRSS('Breitbart politics OR Republican OR conservative', 'Breitbart', 'governance', 'activity');
  }
}

async function fetchWashingtonTimes() {
  try {
    var xml = await timedText('https://www.washingtontimes.com/rss/headlines/news/politics/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('Washington Times', 'governance', 'live', null, count);
      return { value: count, label: count + ' Washington Times items', activity: round(act), channel: 'activity', signal: count + ' Washington Times political items (partisan-right perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Washington Times RSS');
  } catch (e) {
    return _fetchRSS('"Washington Times" politics OR Republican OR conservative', 'Washington Times', 'governance', 'activity');
  }
}

async function fetchNationalReview() {
  try {
    var xml = await timedText('https://www.nationalreview.com/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 25, 0.05, 1.0);
      trackHealth('National Review', 'governance', 'live', null, count);
      return { value: count, label: count + ' National Review items', activity: round(act), channel: 'activity', signal: count + ' National Review items (partisan-right perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty National Review RSS');
  } catch (e) {
    return _fetchRSS('"National Review" politics OR conservative OR Republican', 'National Review', 'governance', 'activity');
  }
}

async function fetchDailyCaller() {
  try {
    var xml = await timedText('https://dailycaller.com/feed/', { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    var count = (xml.match(/<item>/gi) || []).length;
    if (count > 0) {
      var act = clamp(count / 30, 0.05, 1.0);
      trackHealth('Daily Caller', 'governance', 'live', null, count);
      return { value: count, label: count + ' Daily Caller items', activity: round(act), channel: 'activity', signal: count + ' Daily Caller items (partisan-right perspective)', updated: Date.now(), fetchedAt: Date.now() };
    }
    throw new Error('empty Daily Caller RSS');
  } catch (e) {
    return _fetchRSS('"Daily Caller" politics OR conservative OR Republican', 'Daily Caller', 'governance', 'activity');
  }
}

// ─── CULTURE DOMAIN DEEP FEEDS ──────────────────────────────────────────

async function fetchNEANews() {
  return _fetchRSS('"National Endowment for the Arts" OR "NEA grant" OR "NEA funding" OR "arts endowment"', 'NEA News', 'culture', 'stress');
}
async function fetchNEHNews() {
  return _fetchRSS('"National Endowment for the Humanities" OR "NEH grant" OR "humanities funding" OR "humanities endowment"', 'NEH News', 'culture', 'stress');
}
async function fetchUNESCOCulture() {
  return _fetchRSS('UNESCO heritage OR "UNESCO culture" OR "World Heritage" OR "intangible heritage" OR "cultural heritage destruction"', 'UNESCO Culture', 'culture', 'stress');
}
async function fetchPENAmerica() {
  return _fetchRSS('"PEN America" OR "book ban" OR "literary freedom" OR "freedom to write" OR "banned books" OR "artistic freedom"', 'PEN America', 'culture', 'stress');
}
async function fetchArtNewspaper() {
  return _fetchRSS('"Art Newspaper" OR "museum exhibition" OR "art auction" OR "gallery closing" OR "museum funding" OR "cultural institution"', 'Art Newspaper', 'culture', 'stress');
}
async function fetchVariety() {
  return _fetchRSS('Variety entertainment OR "box office" OR "streaming wars" OR "studio layoffs" OR "entertainment industry" OR "film festival"', 'Variety Entertainment', 'culture', 'stress');
}
async function fetchHypebeast() {
  return _fetchRSS('Hypebeast OR "streetwear" OR "cultural trend" OR "sneaker culture" OR "street fashion" OR "youth culture"', 'Hypebeast Trends', 'culture', 'activity');
}
async function fetchPitchfork() {
  return _fetchRSS('Pitchfork OR "album review" OR "music criticism" OR "indie music" OR "new music" OR "music culture"', 'Pitchfork Music', 'culture', 'activity');
}

// ─── CULTURE — MUSIC / STREAMING / SCENE DEEP FEEDS ─────────────────────
// The pulse of music culture: streaming + virality, chart movement, taste-
// making commentary, live performance, emerging artists, and genre/scene
// discourse. These mirror Energy's price/supply/sector signal cluster
// (fetchEIA / fetchOPECBasket / sector RSS), translated to the attention
// economy. No keyed music API is held, so — exactly as the Energy weekly /
// OPEC / sector feeds do — these route through the _fetchRSS Google News
// proxy as keyword-volume signals (same pattern Pitchfork / Hypebeast use).
async function fetchSpotifyCharts() {
  return _fetchRSS('Spotify chart OR "Spotify Top 50" OR "viral song" OR "streaming numbers" OR "song goes viral" OR "TikTok song" OR "streaming surge" OR "most streamed"', 'Spotify Streaming Charts', 'culture', 'activity');
}
async function fetchBillboardCharts() {
  return _fetchRSS('Billboard Hot 100 OR "Billboard 200" OR "number one single" OR "chart debut" OR "tops the chart" OR "chart-topping" OR "Billboard chart"', 'Billboard Charts', 'culture', 'activity');
}
async function fetchGeniusCommentary() {
  return _fetchRSS('Genius lyrics OR "song meaning" OR "lyric breakdown" OR "annotated lyrics" OR "music commentary" OR "fan reaction" OR "track breakdown"', 'Genius Commentary', 'culture', 'activity');
}
async function fetchSongkickTours() {
  return _fetchRSS('tour dates OR "concert tour" OR "world tour announced" OR "tickets on sale" OR "tour cancelled" OR "live music venue" OR "festival lineup" OR "sold out tour"', 'Songkick Tours', 'culture', 'activity');
}
async function fetchSoundcloudEmerging() {
  return _fetchRSS('SoundCloud OR "emerging artist" OR "breakout artist" OR "underground music" OR "indie breakout" OR "rising artist" OR "next big artist" OR "buzz artist"', 'SoundCloud Emerging', 'culture', 'activity');
}
async function fetchMusicSceneDiscourse() {
  return _fetchRSS('"music industry" OR "genre revival" OR "music movement" OR "scene discourse" OR "artist royalties" OR "streaming payouts" OR "label dispute" OR "music backlash"', 'Music Scene Discourse', 'culture', 'stress');
}

// ─── POPULATION DOMAIN DEEP FEEDS ──────────────────────────────────────

async function fetchUNFPA() {
  return _fetchRSS('UNFPA OR "United Nations Population Fund" OR "reproductive health" OR "family planning" OR "population fund"', 'UNFPA', 'population', 'stress');
}
async function fetchCDCNCHS() {
  return _fetchRSS('"National Center for Health Statistics" OR "NCHS" OR "vital statistics" OR "birth rate" OR "death rate" OR "life expectancy" site:cdc.gov', 'CDC NCHS', 'population', 'stress');
}
async function fetchWHOGHO() {
  return _fetchRSS('"Global Health Observatory" OR "WHO population" OR "WHO mortality" OR "WHO fertility" OR "global health statistics"', 'WHO GHO', 'population', 'stress');
}
async function fetchUNHCRDisplacement() {
  return _fetchRSS('UNHCR OR "forced displacement" OR "refugee crisis" OR "internally displaced" OR "asylum seeker" OR "refugee camp"', 'UNHCR Displacement', 'population', 'stress');
}
async function fetchIOMmigration() {
  return _fetchRSS('"International Organization for Migration" OR "IOM migration" OR "migration crisis" OR "migrant deaths" OR "migration route"', 'IOM Migration', 'population', 'stress');
}
async function fetchIHMEPopHealth() {
  return _fetchRSS('IHME OR "Institute for Health Metrics" OR "Global Burden of Disease" OR "population health metrics" OR "excess mortality"', 'IHME Population Health', 'population', 'stress');
}
async function fetchGuttmacherInstitute() {
  return _fetchRSS('Guttmacher OR "reproductive rights" OR "abortion access" OR "contraception access" OR "unintended pregnancy" OR "family planning policy"', 'Guttmacher Institute', 'population', 'stress');
}
async function fetchCensusBureau() {
  return _fetchRSS('"Census Bureau" OR "population estimate" OR "census data" OR "American Community Survey" OR "decennial census" site:census.gov', 'Census Bureau', 'population', 'stress');
}
async function fetchOurWorldInDataPop() {
  return _fetchRSS('"Our World in Data" population OR fertility OR mortality OR "life expectancy" OR "population growth" OR "demographic"', 'Our World in Data Pop', 'population', 'activity');
}
async function fetchPopulationMatters() {
  return _fetchRSS('"Population Matters" OR "population sustainability" OR "overpopulation" OR "population advocacy" OR "population growth concern"', 'Population Matters', 'population', 'activity');
}

// ─── RELIGION ────────────────────────────────────────────────────────────

async function fetchVaticanNews() {
  return _fetchRSS('"Vatican News" OR "Pope Francis" OR "Holy See" OR "Vatican" OR "papal" site:vaticannews.va OR site:vatican.va', 'Vatican News', 'religion', 'stress');
}
async function fetchAlJazeeraReligion() {
  return _fetchRSS('religion OR "interfaith" OR "sectarian" OR "mosque" OR "imam" OR "Muslim" OR "Islam" site:aljazeera.com', 'Al Jazeera Religion', 'religion', 'stress');
}
async function fetchChristianityToday() {
  return _fetchRSS('"Christianity Today" OR "evangelical" OR "church" OR "pastor" OR "denomination" site:christianitytoday.com', 'Christianity Today', 'religion', 'stress');
}
async function fetchReligionNewsService() {
  return _fetchRSS('"Religion News Service" OR "RNS" OR "interfaith" OR "religious" OR "faith community" site:religionnews.com', 'Religion News Service', 'religion', 'stress');
}
async function fetchUSCIRF() {
  return _fetchRSS('"USCIRF" OR "international religious freedom" OR "religious persecution" OR "countries of particular concern" site:uscirf.gov', 'USCIRF', 'religion', 'stress');
}
async function fetchPewReligion() {
  return _fetchRSS('"Pew Research" religion OR "religious landscape" OR "religious affiliation" OR "church attendance" OR "nones" site:pewresearch.org', 'Pew Religion', 'religion', 'stress');
}
async function fetchTimesOfIsraelReligion() {
  return _fetchRSS('"Times of Israel" religion OR "synagogue" OR "rabbi" OR "Jewish" OR "ultra-Orthodox" OR "Haredi" site:timesofisrael.com', 'Times of Israel Religion', 'religion', 'stress');
}
async function fetchHindustanTimesReligion() {
  return _fetchRSS('"Hindustan Times" religion OR "temple" OR "Hindu" OR "mosque" OR "communal" OR "interfaith" site:hindustantimes.com', 'Hindustan Times Religion', 'religion', 'stress');
}
async function fetchBuddhistDoorGlobal() {
  return _fetchRSS('"Buddhistdoor" OR "Buddhist" OR "mindfulness" OR "meditation" OR "monastery" OR "dharma" site:buddhistdoor.net', 'BuddhistDoor Global', 'religion', 'activity');
}
async function fetchSikhNetNews() {
  return _fetchRSS('"SikhNet" OR "Sikh" OR "gurdwara" OR "Khalsa" OR "Guru Granth" OR "langar" site:sikhnet.com', 'SikhNet News', 'religion', 'activity');
}
async function fetchMormonNewsroom() {
  return _fetchRSS('LDS church OR Mormon OR "Church of Jesus Christ" OR "Latter-day Saints" OR Salt Lake Temple OR general conference', 'LDS Mormon Newsroom', 'religion', 'stress');
}
async function fetchJWNews() {
  return _fetchRSS('"Jehovah Witness" OR "Watchtower" OR "Kingdom Hall" OR JW.org OR "Governing Body"', 'JW.org Witnesses', 'religion', 'activity');
}
async function fetchOrthodoxChristianity() {
  return _fetchRSS('Orthodox church OR Ecumenical Patriarch OR Russian Orthodox OR autocephaly OR Greek Orthodox OR Coptic', 'Orthodox Christianity', 'religion', 'stress');
}
async function fetchIslamicFinanceNews() {
  return _fetchRSS('Islamic finance OR sukuk OR halal economy OR sharia compliant OR Islamic banking OR takaful OR waqf', 'Islamic Finance News', 'religion', 'stress');
}
async function fetchJewishTelegraphicAgency() {
  return _fetchRSS('JTA OR "Jewish Telegraphic Agency" OR Jewish community OR antisemitism OR synagogue OR rabbi OR kosher', 'JTA Jewish News', 'religion', 'stress');
}
async function fetchCatholicNewsAgency() {
  return _fetchRSS('"Catholic News Agency" OR CNA OR Vatican OR Pope OR diocese OR Catholic church OR encyclical', 'Catholic News Agency', 'religion', 'stress');
}
async function fetchEsotericSpirituality() {
  return _fetchRSS('esoteric OR occult OR theosophy OR new age OR consciousness OR mysticism OR hermetic OR gnostic OR astrology', 'Esoteric Spirituality', 'religion', 'activity');
}
async function fetchMindfulnessIndustry() {
  return _fetchRSS('mindfulness OR meditation app OR Headspace OR Calm OR spiritual wellness OR yoga retreat OR contemplative', 'Mindfulness Industry', 'religion', 'activity');
}

// ─── Utilities ──────────────────────────────────────────────────────────

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function round(v) { return Math.round(v * 100) / 100; }
