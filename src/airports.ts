// Major airports with their IANA time zones. Picking an airport (rather than typing a
// UTC offset) is what makes daylight saving time come out right for every date.

export interface Airport {
  code: string;
  city: string;
  country: string;
  tz: string;
}

const RAW = `
ATL|Atlanta|United States|America/New_York
BOS|Boston|United States|America/New_York
CLT|Charlotte|United States|America/New_York
DCA|Washington Reagan|United States|America/New_York
IAD|Washington Dulles|United States|America/New_York
DTW|Detroit|United States|America/Detroit
EWR|Newark|United States|America/New_York
JFK|New York JFK|United States|America/New_York
LGA|New York LaGuardia|United States|America/New_York
MCO|Orlando|United States|America/New_York
MIA|Miami|United States|America/New_York
FLL|Fort Lauderdale|United States|America/New_York
PHL|Philadelphia|United States|America/New_York
ORD|Chicago O'Hare|United States|America/Chicago
DFW|Dallas/Fort Worth|United States|America/Chicago
IAH|Houston|United States|America/Chicago
AUS|Austin|United States|America/Chicago
MSP|Minneapolis|United States|America/Chicago
MSY|New Orleans|United States|America/Chicago
DEN|Denver|United States|America/Denver
PHX|Phoenix|United States|America/Phoenix
SLC|Salt Lake City|United States|America/Denver
LAS|Las Vegas|United States|America/Los_Angeles
LAX|Los Angeles|United States|America/Los_Angeles
SAN|San Diego|United States|America/Los_Angeles
SFO|San Francisco|United States|America/Los_Angeles
SJC|San Jose|United States|America/Los_Angeles
SEA|Seattle|United States|America/Los_Angeles
PDX|Portland|United States|America/Los_Angeles
ANC|Anchorage|United States|America/Anchorage
HNL|Honolulu|United States|Pacific/Honolulu
YYZ|Toronto|Canada|America/Toronto
YUL|Montreal|Canada|America/Toronto
YVR|Vancouver|Canada|America/Vancouver
YYC|Calgary|Canada|America/Edmonton
YYT|St. John's|Canada|America/St_Johns
MEX|Mexico City|Mexico|America/Mexico_City
GDL|Guadalajara|Mexico|America/Mexico_City
MTY|Monterrey|Mexico|America/Monterrey
CUN|Cancún|Mexico|America/Cancun
TIJ|Tijuana|Mexico|America/Tijuana
SJD|Los Cabos|Mexico|America/Mazatlan
PTY|Panama City|Panama|America/Panama
SJO|San José|Costa Rica|America/Costa_Rica
BOG|Bogotá|Colombia|America/Bogota
MDE|Medellín|Colombia|America/Bogota
LIM|Lima|Peru|America/Lima
UIO|Quito|Ecuador|America/Guayaquil
SCL|Santiago|Chile|America/Santiago
EZE|Buenos Aires|Argentina|America/Argentina/Buenos_Aires
GRU|São Paulo|Brazil|America/Sao_Paulo
GIG|Rio de Janeiro|Brazil|America/Sao_Paulo
HAV|Havana|Cuba|America/Havana
SJU|San Juan|Puerto Rico|America/Puerto_Rico
PUJ|Punta Cana|Dominican Republic|America/Santo_Domingo
LHR|London Heathrow|United Kingdom|Europe/London
LGW|London Gatwick|United Kingdom|Europe/London
MAN|Manchester|United Kingdom|Europe/London
EDI|Edinburgh|United Kingdom|Europe/London
DUB|Dublin|Ireland|Europe/Dublin
CDG|Paris|France|Europe/Paris
NCE|Nice|France|Europe/Paris
AMS|Amsterdam|Netherlands|Europe/Amsterdam
BRU|Brussels|Belgium|Europe/Brussels
FRA|Frankfurt|Germany|Europe/Berlin
MUC|Munich|Germany|Europe/Berlin
BER|Berlin|Germany|Europe/Berlin
ZRH|Zurich|Switzerland|Europe/Zurich
GVA|Geneva|Switzerland|Europe/Zurich
VIE|Vienna|Austria|Europe/Vienna
MAD|Madrid|Spain|Europe/Madrid
BCN|Barcelona|Spain|Europe/Madrid
AGP|Málaga|Spain|Europe/Madrid
LIS|Lisbon|Portugal|Europe/Lisbon
OPO|Porto|Portugal|Europe/Lisbon
FCO|Rome|Italy|Europe/Rome
MXP|Milan|Italy|Europe/Rome
VCE|Venice|Italy|Europe/Rome
ATH|Athens|Greece|Europe/Athens
IST|Istanbul|Turkey|Europe/Istanbul
CPH|Copenhagen|Denmark|Europe/Copenhagen
ARN|Stockholm|Sweden|Europe/Stockholm
OSL|Oslo|Norway|Europe/Oslo
HEL|Helsinki|Finland|Europe/Helsinki
KEF|Reykjavík|Iceland|Atlantic/Reykjavik
WAW|Warsaw|Poland|Europe/Warsaw
PRG|Prague|Czechia|Europe/Prague
BUD|Budapest|Hungary|Europe/Budapest
CAI|Cairo|Egypt|Africa/Cairo
CMN|Casablanca|Morocco|Africa/Casablanca
JNB|Johannesburg|South Africa|Africa/Johannesburg
CPT|Cape Town|South Africa|Africa/Johannesburg
NBO|Nairobi|Kenya|Africa/Nairobi
ADD|Addis Ababa|Ethiopia|Africa/Addis_Ababa
LOS|Lagos|Nigeria|Africa/Lagos
TLV|Tel Aviv|Israel|Asia/Jerusalem
AMM|Amman|Jordan|Asia/Amman
DXB|Dubai|United Arab Emirates|Asia/Dubai
AUH|Abu Dhabi|United Arab Emirates|Asia/Dubai
DOH|Doha|Qatar|Asia/Qatar
RUH|Riyadh|Saudi Arabia|Asia/Riyadh
DEL|Delhi|India|Asia/Kolkata
BOM|Mumbai|India|Asia/Kolkata
BLR|Bengaluru|India|Asia/Kolkata
KTM|Kathmandu|Nepal|Asia/Kathmandu
CMB|Colombo|Sri Lanka|Asia/Colombo
MLE|Malé|Maldives|Indian/Maldives
BKK|Bangkok|Thailand|Asia/Bangkok
HKT|Phuket|Thailand|Asia/Bangkok
SGN|Ho Chi Minh City|Vietnam|Asia/Ho_Chi_Minh
HAN|Hanoi|Vietnam|Asia/Bangkok
KUL|Kuala Lumpur|Malaysia|Asia/Kuala_Lumpur
SIN|Singapore|Singapore|Asia/Singapore
CGK|Jakarta|Indonesia|Asia/Jakarta
DPS|Bali|Indonesia|Asia/Makassar
MNL|Manila|Philippines|Asia/Manila
HKG|Hong Kong|Hong Kong|Asia/Hong_Kong
TPE|Taipei|Taiwan|Asia/Taipei
PEK|Beijing|China|Asia/Shanghai
PVG|Shanghai|China|Asia/Shanghai
CAN|Guangzhou|China|Asia/Shanghai
ICN|Seoul Incheon|South Korea|Asia/Seoul
NRT|Tokyo Narita|Japan|Asia/Tokyo
HND|Tokyo Haneda|Japan|Asia/Tokyo
KIX|Osaka|Japan|Asia/Tokyo
SYD|Sydney|Australia|Australia/Sydney
MEL|Melbourne|Australia|Australia/Melbourne
BNE|Brisbane|Australia|Australia/Brisbane
PER|Perth|Australia|Australia/Perth
ADL|Adelaide|Australia|Australia/Adelaide
AKL|Auckland|New Zealand|Pacific/Auckland
NAN|Nadi|Fiji|Pacific/Fiji
PPT|Papeete|French Polynesia|Pacific/Tahiti
`;

export const AIRPORTS: Airport[] = RAW.trim()
  .split('\n')
  .map((line) => {
    const [code, city, country, tz] = line.split('|');
    return { code, city, country, tz };
  });

const BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a]));

export function findAirport(code: string): Airport | undefined {
  return BY_CODE.get(code.trim().toUpperCase());
}

export function airportLabel(a: Airport): string {
  return `${a.code} — ${a.city}, ${a.country}`;
}
