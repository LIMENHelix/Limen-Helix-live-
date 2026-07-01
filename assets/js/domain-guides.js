/**
 * domain-guides.js, the "what to do right now" action playbooks.
 *
 * A domain front (domain-front.html) reads its live pulse, matches the current
 * condition, and renders a 4-lane action guide: Survive · Save money · Position
 * · Act. Content is curated + honestly framed:
 *   - "position" = companies with EXPOSURE, for research, NOT buy recommendations.
 *   - "survive"  = widely-recommended prep, not emergency instruction. Official
 *                  alerts always win in a real emergency.
 *
 * Extensible: add more domains under GUIDES. Each condition = { title, when,
 * survive[], save[], position:{note, names[]}, act[] }.
 */
(function () {
  'use strict';

  var GUIDES = {
    environment: {
      cta: { href: '/energy', label: 'Break down & lower your utility bill, free Energy Bill X-Ray →' },
      // pick the active condition from the live pulse (stress + top signal text)
      match: function (d) {
        var sig = String((d && d.topSignal) || '').toLowerCase();
        var stress = (d && typeof d.stress === 'number') ? d.stress : 0;
        if (/drought|fertiliz|water|reservoir|crop|food/.test(sig)) return 'drought';
        if (/heat|temperature|warm|hot/.test(sig)) return 'heat';
        if (/fire|smoke|air|pollut|ozone|particul/.test(sig)) return 'air';
        if (/flood|storm|hurricane|rain|surge/.test(sig)) return 'storm';
        if (/contaminat|toxic|spill|lead|sewage/.test(sig)) return 'water';
        return stress >= 0.6 ? 'drought' : 'heat'; // sensible default to what's usually hot
      },
      conditions: {
        heat: {
          title: 'Extreme heat',
          when: 'Heat waves + grid strain',
          survive: [
            'Close blinds on sun-facing windows by day; open the house up at night.',
            'Hydrate before you feel thirsty; skip alcohol/caffeine in peak heat.',
            'Know your nearest cooling center, libraries and rec centers usually qualify.',
            'Never leave kids or pets in a parked car, even briefly.'
          ],
          save: [
            'Set AC to ~78°F when home, higher when out; a fan cools <b>people</b>, not empty rooms.',
            'Run laundry/dishwasher at night, many utilities charge less off-peak.',
            'Ask your utility about budget billing + summer heat-relief / weatherization rebates.'
          ],
          position: { note: 'Cooling demand and grid stress lift certain sectors. Exposure, not advice.',
            names: ['ETN (grid/cooling)', 'CARR (HVAC)', 'AWK (water)'] },
          act: [
            'Many states ban utility shut-offs during heat emergencies, know if yours does.',
            'Log any outages/brownouts (time + duration), it documents grid failure.'
          ]
        },
        drought: {
          title: 'Drought & water stress',
          when: 'Low reservoirs, rising water & food costs',
          survive: [
            'Store water: the common guidance is <b>~1 gallon per person per day, 2 weeks’ worth</b>; rotate every 6 months.',
            'Fix leaks first, a single dripping faucet can waste gallons a day.',
            'Keep a few days of shelf-stable food; drought pushes food prices up over months.'
          ],
          save: [
            'Outdoor watering is the biggest use, cut it first; water early morning to reduce loss.',
            'Check for rebates on low-flow fixtures and drought-tolerant / turf-replacement landscaping.',
            'Expect water bills to climb in drought, build it into your budget now.'
          ],
          position: { note: 'Water supply, treatment, irrigation, and fertilizer names carry the most exposure. Research, not advice.',
            names: ['AWK (water utility)', 'LNN (irrigation)', 'ECL (water treatment)', 'MOS (fertilizer)'] },
          act: [
            'Look up your area’s drought stage and any watering restrictions.',
            'Many water districts offer turf-swap and rain-barrel rebates, worth a search.'
          ]
        },
        water: {
          title: 'Water contamination / advisory',
          when: 'Boil notices, spills, or system violations',
          survive: [
            'Under a boil advisory: <b>boil 1 minute</b> before drinking, cooking, or brushing; use bottled for infants.',
            'Don’t drink from the tap until officials clear it, even if it looks fine.',
            'Keep a few gallons of bottled water on hand for exactly this.'
          ],
          save: [
            'An NSF-certified filter is far cheaper long-term than ongoing bottled water.',
            'You’re owed a Consumer Confidence Report, it’s free and lists your water’s issues.'
          ],
          position: { note: 'Water testing, treatment, and filtration names have exposure. Research, not advice.',
            names: ['ECL (treatment)', 'AWK (utility)', 'XYL (water tech)'] },
          act: [
            'Look up your system’s violations on EPA ECHO (free), search your utility.',
            'Report new taste/odor/color changes to your utility; it triggers testing.'
          ]
        },
        air: {
          title: 'Wildfire smoke / poor air',
          when: 'High AQI, fire season',
          survive: [
            'Check your AQI daily; when it’s high, stay indoors and keep windows shut.',
            'Run a HEPA purifier, or a cheap DIY box-fan + MERV-13 filter, in one “clean room.”',
            'Wear an N95 (not cloth) outdoors when smoke is heavy.'
          ],
          save: [
            'A $30 box fan + a furnace filter is a legitimately effective DIY air purifier.',
            'Change HVAC filters more often in smoke season to protect the system.'
          ],
          position: { note: 'Air filtration and indoor-air names carry exposure. Research, not advice.',
            names: ['CARR (HVAC/air)', 'AOS (filtration)', 'MMM (respirators)'] },
          act: [
            'Sign up for your county’s emergency alerts and know your evacuation zone.',
            'Keep a go-bag ready in fire season, documents, meds, chargers.'
          ]
        },
        storm: {
          title: 'Storm & flood',
          when: 'Severe weather, flooding',
          survive: [
            'Know your flood zone; move valuables up; <b>never drive through moving water.</b>',
            'Charge devices and fill water containers before it hits.',
            'Have a go-bag: meds, documents, cash, flashlight, chargers.'
          ],
          save: [
            'Standard home insurance does NOT cover flood, check NFIP coverage <b>before</b> a storm (30-day wait to take effect).',
            'Photograph your home/belongings now; it speeds any future claim.'
          ],
          position: { note: 'Rebuild materials, restoration, and insurance names have exposure. Research, not advice.',
            names: ['HD (materials)', 'BLDR (building products)', 'ALL (insurance)'] },
          act: [
            'Document damage with photos before and after any cleanup.',
            'Know FEMA assistance channels (disasterassistance.gov) for declared disasters.'
          ]
        }
      }
    }
  };

  window.LIMEN_DOMAIN_GUIDES = GUIDES;
})();
