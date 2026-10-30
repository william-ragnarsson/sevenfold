import { deckFromText } from "@/features/deck-reader/parser";
import { AIRBNB_SAMPLE } from "@/lib/samples/airbnb";
import { initialState, streamReducer } from "@/lib/diligence/stream-state";
import type { DeckFeedbackItem, FieldSource, InvestVerdict, ProgressEvent, Source } from "@/lib/diligence/types";
import type { CompetitiveLandscape } from "@/lib/diligence/types";

/**
 * A scripted run of the Airbnb sample, for working on the run's UI without
 * paying for one. Dev only: `AnalysisProvider.replaySample` plays it on
 * timers into the same reducer a real stream feeds, so every page sees what
 * it would see live. The events follow the real pipeline's order and rough
 * timing (`lib/diligence/engine.ts`); the content is hand-written, and the
 * deck values quote their slides so `citedSlides` keeps them.
 */

/** One event, and when it arrives in ms after the run starts. */
export interface ReplayStep {
  at: number;
  event: ProgressEvent;
}

const PAGES = 29;

export function buildAirbnbReplay(): ReplayStep[] {
  const steps: ReplayStep[] = [];
  const at = (ms: number, ...events: ProgressEvent[]) => {
    for (const event of events) steps.push({ at: ms, event });
  };
  const field = (ms: number, key: string, value: unknown, source: FieldSource, slides?: number[]) =>
    at(ms, { type: "field", key, value, source, ...(slides ? { slides } : {}) });
  const stage = (ms: number, id: string, state: "start" | "done") => at(ms, { type: "stage", id, state });

  // Reading the deck: every page in turn, the text-less ones included.
  const { slides } = deckFromText(AIRBNB_SAMPLE.deckText, PAGES);
  stage(0, "deck", "start");
  at(0, { type: "deck", pageCount: PAGES });
  for (let page = 1; page <= PAGES; page++) {
    const text = slides.find((s) => s.index === page)?.text ?? "";
    at(80 + page * 45, { type: "slide", index: page, text });
  }
  at(1500, { type: "deck-read", via: "provided" });
  stage(1500, "deck", "done");

  // extract: the memo drafted from the deck alone.
  at(1500, { type: "status", phase: "extracting", message: "Reading the deck" });
  stage(1500, "extract", "start");
  field(5200, "company.name", "Airbnb (AirBed & Breakfast)", "deck", [2, 23]);
  field(6400, "company.description", "A web platform to book rooms with locals rather than hotels: travelers save money, hosts make money renting out their space.", "deck", [2, 6]);
  field(7300, "company.founded", "unknown", "unknown");
  field(7800, "company.basedIn", "unknown", "unknown");
  field(9100, "founders", [
    { role: "CEO", name: "Brian Chesky", commitment: "Full-time | Co-founder", background: ["Business development and brand", "BFA in industrial design from RISD", "Founded Brian Chesky Inc, an industrial design consultancy"] },
    { role: "CPO", name: "Joe Gebbia", commitment: "Full-time | Co-founder", background: ["User interface and PR", "Dual BFAs in graphic and industrial design from RISD", "Holds a patent for Critbuns"] },
    { role: "CTO", name: "Nathan Blecharczyk", commitment: "Full-time | Co-founder", background: ["Developer; built the Facebook app \"Your neighbors\" (75,000 users)", "Computer science at Harvard", "Worked at Microsoft, OPNET Technologies and Batiq"] },
  ], "deck", [22]);
  field(10200, "founders.howTheyMet", "unknown", "unknown");
  field(10600, "founders.capTable", "unknown", "unknown");
  field(11800, "team.headcount", "Three founders, plus Michael Seibel (CEO of justin.tv) as advisor.", "deck", [22]);
  field(12700, "team.runway", "Raising 12 months of financing: a $500K angel round.", "deck", [27]);
  field(14000, "problem.core", "Price is an important concern for people booking travel online, and hotels leave you disconnected from the city and its culture.", "deck", [3]);
  field(15100, "problem.insight", "No easy way exists to book a room with a local or become a host, yet couchsurfing.com has 670,000 users and craigslist.com ran 17,000 temporary housing listings in one week.", "deck", [3, 7]);
  field(16300, "solution.core", "A web platform where users rent out their space to host travelers: save money when traveling, make money when hosting, share culture.", "deck", [6]);
  field(17400, "solution.defensibility", "First to market for a transaction-based temporary housing site; hosts list once instead of daily on craigslist, and guests book in 3 clicks.", "deck", [21]);
  field(18500, "market.gtm", "Target big events monthly (Octoberfest, Cebit, Eurocup), partner with cheap travel sites (GoLoco, Kayak, Orbitz) and offer craigslist dual posting.", "deck", [18]);
  field(19400, "market.revenueModel", "A 10% commission on each transaction; the average fee is $25 ($80/night for 3 nights).", "deck", [15]);
  field(20100, "market.traction", "unknown", "unknown");
  field(20800, "market.competitiveLandscape", "Places itself alone in the affordable, online transaction quadrant; competitors occupy the other three.", "deck", [20]);
  field(21500, "market.technologicalApplication", "A consumer web marketplace; nothing proprietary is claimed.", "inferred");
  stage(22000, "extract", "done");

  // research and landscape start together once the draft is in.
  at(22000, { type: "status", phase: "researching", message: "Researching online" });
  stage(22000, "landscape", "start");
  stage(22000, "research", "start");

  const research: { at: number; query: string; sources: Source[]; notes: string[] }[] = [
    {
      at: 25000,
      query: "Airbnb AirBed & Breakfast founded San Francisco 2008",
      sources: [
        { title: "AirBed & Breakfast takes on the DNC", url: "https://techcrunch.com/2008/08/11/airbed-and-breakfast-takes-pad-sharing-to-the-dnc/" },
        { title: "Airbnb: the story behind the $1.3bn room-letting website", url: "https://www.theguardian.com/technology/2012/sep/02/airbnb-room-letting-website" },
        { title: "How Airbnb started", url: "https://www.inc.com/magazine/201402/airbnb-founders-how-they-started.html" },
      ],
      notes: [
        "Founded in San Francisco in August 2008 as AirBed & Breakfast. ",
        "Chesky and Gebbia met at RISD and rented air mattresses in their apartment during a design conference in 2007; Blecharczyk, Gebbia's former roommate, joined to build the site.\n\n",
      ],
    },
    {
      at: 40000,
      query: "AirBed & Breakfast Democratic National Convention Denver bookings",
      sources: [
        { title: "Denver's hotel shortage and the convention crowd", url: "https://www.nytimes.com/2008/08/21/us/politics/21denver.html" },
        { title: "Obama O's and Cap'n McCains", url: "https://www.fastcompany.com/1784823/how-airbnb-founders-funded-company-cereal" },
      ],
      notes: [
        "The relaunch targeted the Democratic convention in Denver, August 2008, when the city ran short of hotel rooms; about 80 hosts listed rooms. ",
        "The founders funded the company on credit cards and by selling election-themed cereal boxes; no outside investment yet.\n\n",
      ],
    },
    {
      at: 58000,
      query: "couchsurfing craigslist vacation rentals competitors 2008",
      sources: [
        { title: "About Couchsurfing", url: "https://about.couchsurfing.com/about/about-us/" },
        { title: "VRBO: vacation rentals by owner", url: "https://www.vrbo.com/" },
        { title: "HomeAway raises $250 million", url: "https://techcrunch.com/2008/11/04/homeaway-raises-250-million/" },
      ],
      notes: [
        "Couchsurfing is free, so hosts earn nothing; Craigslist listings must be reposted daily and have no payments or profiles. ",
        "VRBO and HomeAway rent whole vacation homes at higher prices, and HomeAway is well funded.",
      ],
    },
  ];
  for (const search of research) {
    at(search.at, { type: "search", query: search.query });
    search.sources.forEach((source, i) => at(search.at + 2500 + i * 900, { type: "source", ...source }));
    search.notes.forEach((text, i) => at(search.at + 6000 + i * 3500, { type: "note", text }));
  }
  stage(95000, "research", "done");

  const landscapeSearches: { at: number; query: string; sources: Source[] }[] = [
    {
      at: 26500,
      query: "peer to peer room rental sites 2008",
      sources: [
        { title: "Couchsurfing", url: "https://www.couchsurfing.com/" },
        { title: "Craigslist temporary housing", url: "https://sfbay.craigslist.org/" },
      ],
    },
    {
      at: 45000,
      query: "vacation rental by owner market 2008",
      sources: [
        { title: "VRBO", url: "https://www.vrbo.com/" },
        { title: "HomeAway", url: "https://www.homeaway.com/" },
      ],
    },
    {
      at: 70000,
      query: "budget hotel booking sites hostels online",
      sources: [
        { title: "Hostelworld", url: "https://www.hostelworld.com/" },
        { title: "Hotels.com", url: "https://www.hotels.com/" },
      ],
    },
  ];
  for (const search of landscapeSearches) {
    at(search.at, { type: "landscape-search", query: search.query });
    search.sources.forEach((source, i) => at(search.at + 3000 + i * 1100, { type: "landscape-source", ...source }));
  }
  const landscape: CompetitiveLandscape = {
    xAxis: { label: "Price", low: "Free or cheap", high: "Expensive", why: "Travelers on a budget are the deck's whole market." },
    yAxis: { label: "Booking", low: "Arranged offline", high: "Booked and paid online", why: "Paying online is what lets a host earn and a guest trust the stay." },
    summary: "Airbnb sits alone where stays are cheap and booked online. Couchsurfing and Craigslist are cheap but arranged by hand; hotels and vacation rentals book online but cost more.",
    companies: [
      { name: "Airbnb", website: "https://www.airbnb.com", x: 22, y: 86, subject: true, description: "Rooms in locals' homes, booked online.", whyCompetitor: "", contrast: "", rank: null },
      { name: "Couchsurfing", website: "https://www.couchsurfing.com", x: 4, y: 30, subject: false, description: "Free stays on locals' couches.", whyCompetitor: "Same travelers, same idea of staying with a local.", contrast: "Hosts earn money, and bookings are paid online.", rank: 1 },
      { name: "Craigslist", website: "https://www.craigslist.org", x: 28, y: 18, subject: false, description: "Classified ads, temporary housing included.", whyCompetitor: "Where hosts list spare rooms today.", contrast: "List once, with profiles and payments, instead of reposting daily.", rank: 2 },
      { name: "VRBO", website: "https://www.vrbo.com", x: 68, y: 64, subject: false, description: "Whole vacation homes rented by their owners.", whyCompetitor: "Travelers renting from private owners.", contrast: "A room in a lived-in home, at a fraction of the price.", rank: 3 },
      { name: "HomeAway", website: "https://www.homeaway.com", x: 72, y: 70, subject: false, description: "A network of vacation rental sites.", whyCompetitor: "Owner rentals at scale.", contrast: "Cheaper short stays in cities, not holiday homes.", rank: null },
      { name: "Hostelworld", website: "https://www.hostelworld.com", x: 18, y: 78, subject: false, description: "Hostel beds booked online.", whyCompetitor: "The budget traveler's online default.", contrast: "A private room and a local host instead of a dorm.", rank: null },
      { name: "Hotels.com", website: "https://www.hotels.com", x: 82, y: 92, subject: false, description: "Hotel rooms booked online.", whyCompetitor: "What travelers book instead.", contrast: "Cheaper, and connected to the city.", rank: null },
    ],
    sources: landscapeSearches.flatMap((s) => s.sources),
  };
  at(105000, { type: "landscape", landscape });
  stage(105000, "landscape", "done");

  // complete: the gaps filled from research.
  at(95000, { type: "status", phase: "completing", message: "Completing the form" });
  stage(95000, "complete", "start");
  field(101000, "company.founded", "August 2008", "web");
  field(103500, "company.basedIn", "San Francisco, California", "web");
  field(107000, "founders.howTheyMet", "Chesky and Gebbia met at the Rhode Island School of Design; Blecharczyk was Gebbia's former roommate.", "web");
  field(111000, "founders.capTable", "Founder-owned: no outside investment before this round.", "inferred");
  field(116000, "market.traction", "Relaunched at the Democratic convention in Denver in August 2008, with about 80 hosts listing rooms while the city ran short of hotel rooms.", "web");
  stage(132000, "complete", "done");

  // scorecard, then feedback, each after the one before.
  stage(132000, "scorecard", "start");
  const ratings: [string, number][] = [
    ["team", 4],
    ["technology", 2],
    ["marketSize", 5],
    ["valueProposition", 4],
    ["competitiveAdvantage", 3],
    ["socialImpact", 3],
  ];
  ratings.forEach(([key, value], i) => field(140000 + i * 1500, `scorecard.${key}`, value, "inferred"));
  field(149500, "scorecard.funding", 0, "web");
  stage(152000, "scorecard", "done");

  at(152000, { type: "status", phase: "completing", message: "Reviewing the pitch deck" });
  stage(152000, "feedback", "start");
  const feedback: DeckFeedbackItem[] = [
    { severity: "critical", category: "Traction", title: "No usage numbers", detail: "The deck shows press quotes and testimonials but no bookings, hosts or revenue to date.", slides: [23, 24] },
    { severity: "warning", category: "Market", title: "Market share asserted, not earned", detail: "Taking 15% of 560M budget trips is a claim; nothing shows how the first few thousand arrive.", slides: [8] },
    { severity: "warning", category: "Competition", title: "Competitors left unnamed", detail: "The quadrant leaves the other three corners blank, so the reader can't judge who else is there.", slides: [20] },
    { severity: "strength", category: "Problem", title: "A crisp problem and solution", detail: "Price, disconnection and the missing booking flow each map to one part of the product.", slides: [3, 6] },
    { severity: "strength", category: "Team", title: "Builders on both sides", detail: "Two designers and an engineer who has already shipped to 75,000 users.", slides: [22] },
    { severity: "strength", category: "Business model", title: "Simple unit economics", detail: "A 10% commission and a $25 average fee make the revenue easy to follow.", slides: [15] },
  ];
  feedback.forEach((item, i) => at(158000 + i * 4800, { type: "feedback", item }));
  stage(188000, "feedback", "done");

  const verdict: InvestVerdict = { invest: true, available: true, score: 0.71, threshold: 0.5 };
  at(188000, { type: "status", phase: "verdict", message: "Running the investment model" });
  stage(188000, "verdict", "start");
  at(188900, { type: "verdict", verdict });
  stage(189000, "verdict", "done");

  steps.sort((a, b) => a.at - b.at);

  // The report the engine would assemble: the form as the events left it, plus
  // the slices stages write into it directly.
  const folded = steps.reduce((state, { event }) => streamReducer(state, { type: "event", event }), initialState());
  const end = steps[steps.length - 1].at + 400;
  at(end, { type: "status", phase: "done", message: "Report ready" });
  at(end, {
    type: "report",
    report: {
      ...folded.form,
      sources: research.flatMap((s) => s.sources),
      verdict,
      deckFeedback: feedback,
      landscape,
      generatedAt: new Date().toISOString(),
    },
  });
  return steps;
}
