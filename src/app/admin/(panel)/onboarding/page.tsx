/**
 * /admin/onboarding — long-form welcome doc for a new sales/marketing
 * teammate. Read top-to-bottom on day one, then kept open as reference.
 *
 * Qualitative only — no specific pricing, revenue, or owner financials.
 * Quantitative playbook lives separately and is shared 1:1 with Abe.
 */

import Image, { type StaticImageData } from "next/image";

import cinemaPhoto from "@brand/docs/photos/cinema.jpg";
import firePitPhoto from "@brand/docs/photos/fire-pit.jpg";
import gameRoomPhoto from "@brand/docs/photos/game-room.jpg";
import heroPhoto from "@brand/docs/photos/hero.jpg";
import hotTubPhoto from "@brand/docs/photos/hot-tub.jpg";
import supperClubPhoto from "@brand/docs/photos/supper-club.jpg";

import { Starburst } from "@/components/brand/Starburst";
import { StatStrip } from "@/components/brand/StatStrip";
import { Wordmark } from "@/components/brand/Wordmark";

import styles from "./onboarding.module.css";

export const dynamic = "force-static";

export const metadata = {
  title: "Onboarding · The Jackpot",
};

interface PhotoTile {
  src: StaticImageData;
  alt: string;
  label: string;
}

const PHOTO_TILES: PhotoTile[] = [
  { src: heroPhoto, alt: "The Jackpot courtyard at dusk", label: "The Courtyard" },
  { src: hotTubPhoto, alt: "The spa after dark", label: "The Spa" },
  { src: cinemaPhoto, alt: "The cinema with the lights down", label: "The Cinema" },
  { src: gameRoomPhoto, alt: "The parlor with the bar open", label: "The Parlor" },
  { src: firePitPhoto, alt: "The fireside with embers up", label: "The Fireside" },
  { src: supperClubPhoto, alt: "The supper club at seven o’clock", label: "The Supper Club" },
];

const TOC = [
  { id: "what", label: "What it is" },
  { id: "property", label: "The property" },
  { id: "guest", label: "Who books it" },
  { id: "voice", label: "How we sound" },
  { id: "sell", label: "How we sell" },
  { id: "brand", label: "The brand" },
  { id: "flow", label: "Inquiries" },
  { id: "tools", label: "Tools" },
];

const PALETTE = [
  { name: "Gold", hex: "#d4a930", role: "Primary" },
  { name: "Peach", hex: "#ff9050", role: "Spark" },
  { name: "Linen", hex: "#faf6ef", role: "Surface" },
  { name: "Sage", hex: "#8aa077", role: "Nature" },
  { name: "Terra", hex: "#c08050", role: "Warmth" },
  { name: "Olive", hex: "#7a6030", role: "Text" },
];

export default function OnboardingPage() {
  return (
    <div className={styles.shell}>
      {/* ───── Hero ───── */}
      <header className={styles.hero}>
        <div className={styles.heroBurst}>
          <Starburst size={120} tier={8} color="#ffffff" secondary="#ffffff" center="#ffffff" axisOpacity={1} diagOpacity={0.8} terOpacity={0.5} />
        </div>
        <div className={styles.heroBurstSmall}>
          <Starburst size={70} tier={6} color="#ffffff" secondary="#ffffff" center="#ffffff" axisOpacity={1} diagOpacity={0.6} />
        </div>
        <div className={styles.heroInner}>
          <div className={styles.heroEyebrow}>Sales &amp; Marketing · Onboarding</div>
          <Wordmark size="xl" color="white" align="left" as="div" />
          <h1 className={styles.heroTitle}>Welcome to the team.</h1>
          <p className={styles.heroSub}>
            This page is your map. Read it once, then keep it open. It’s the
            short version of how The Jackpot looks, sounds, and sells — written
            for the first week, but built to stay useful in the tenth.
          </p>
          <div className={styles.heroMeta}>Last refreshed · in-house doc</div>
        </div>
      </header>

      {/* ───── TOC ───── */}
      <nav className={styles.toc} aria-label="Page sections">
        {TOC.map((t) => (
          <a key={t.id} href={`#${t.id}`} className={styles.tocChip}>
            {t.label}
          </a>
        ))}
      </nav>

      <div className={styles.page}>
        {/* ───── 1. What The Jackpot is ───── */}
        <section id="what" className={`${styles.section} ${styles.anchor}`}>
          <div className={styles.sectionEyebrow}>Chapter one</div>
          <h2 className={styles.sectionTitle}>What The Jackpot is</h2>
          <p className={styles.sectionLead}>
            The shortest accurate answer comes from the brand book itself.
          </p>

          <div className={styles.pullQuote}>
            <div className={styles.pullQuoteBurst}>
              <Starburst size={20} tier={8} />
            </div>
            <p className={styles.pullQuoteText}>
              A luxury group home in Chicago whose brand feels like fruit bowl
              and brunch at golden hour — warm, bright, celebratory, and alive.
            </p>
            <div className={styles.pullQuoteAttr}>The brand in one sentence</div>
          </div>

          <p className={styles.bodyText}>
            It sleeps fourteen. It’s where milestone birthdays, bachelorette
            weekends, family reunions, and friend-group celebrations happen —
            the kind of trip people plan for months and remember for years. It
            is <em>not</em> a rental, a listing, or a party house. The brand
            never speaks any of those three words, and neither do we.
          </p>
          <p className={styles.bodyText}>
            Everything about The Jackpot is warm and considered. The color
            palette is gold and peach. The fonts are Cormorant Garamond and
            Outfit. The photography is golden-hour, lifestyle, never clinical.
            There is no version of this brand that goes dark, cold, or
            corporate. When something on our side feels off-brand, it usually
            is — trust that instinct.
          </p>
        </section>

        {/* ───── 2. The property ───── */}
        <section id="property" className={`${styles.section} ${styles.anchor}`}>
          <div className={styles.sectionEyebrow}>Chapter two</div>
          <h2 className={styles.sectionTitle}>The property</h2>
          <p className={styles.sectionLead}>
            Big enough for a real celebration. Small enough to feel like one
            house, not a hotel.
          </p>

          <div className={styles.statWrap}>
            <StatStrip
              tone="dark"
              stats={[
                { value: "14", label: "Guests" },
                { value: "5", label: "Bedrooms" },
                { value: "4", label: "Bathrooms" },
                { value: "1", label: "Cinema" },
                { value: "1", label: "Spa" },
                { value: "1", label: "Bar" },
              ]}
            />
          </div>

          <div className={styles.photoGrid}>
            {PHOTO_TILES.map((tile) => (
              <div key={tile.label} className={styles.photoCell}>
                <Image src={tile.src} alt={tile.alt} fill sizes="(max-width: 460px) 100vw, (max-width: 720px) 50vw, 33vw" />
                <div className={styles.photoOverlay} aria-hidden="true" />
                <div className={styles.photoLabel}>{tile.label}</div>
              </div>
            ))}
          </div>

          <p className={styles.bodyText} style={{ marginTop: 24 }}>
            The full photo set lives in <em>/brand/docs/photos</em>. When you
            need imagery for an outbound message, an ad, or a deck — pull from
            there first. Every photo in that folder has already been graded to
            match the brand. Stock photos, screenshots, or anything cool-toned
            will read as wrong immediately.
          </p>
        </section>

        {/* ───── 3. Who books it ───── */}
        <section id="guest" className={`${styles.section} ${styles.anchor}`}>
          <div className={styles.sectionEyebrow}>Chapter three</div>
          <h2 className={styles.sectionTitle}>Who books The Jackpot</h2>
          <p className={styles.sectionLead}>
            We are deliberately narrow. The Jackpot is a 14-guest luxury home,
            which means the wrong crew can do real damage to the property and
            to the brand. Price is our first filter; voice is our second.
            You’re our third.
          </p>

          <div className={styles.personaGrid}>
            <div className={`${styles.personaCard} ${styles.yes}`}>
              <div className={styles.personaCardLabel}>Yes — the dream guest</div>
              <h3 className={styles.personaCardTitle}>Celebrating crews who plan.</h3>
              <ul className={styles.personaList}>
                <li>Milestone birthdays — 30th, 40th, 50th, a parent’s 70th.</li>
                <li>Bachelorette and bachelor weekends, especially the considered, tasteful kind.</li>
                <li>Family reunions and multi-generation trips.</li>
                <li>Friend-group anniversaries — the annual reunion trip.</li>
                <li>Small corporate retreats with a celebratory or creative angle.</li>
                <li>Guests who ask thoughtful questions before they ask the price.</li>
              </ul>
            </div>
            <div className={`${styles.personaCard} ${styles.no}`}>
              <div className={styles.personaCardLabel}>Not for us</div>
              <h3 className={styles.personaCardTitle}>Anyone we’d regret hosting.</h3>
              <ul className={styles.personaList}>
                <li>Looking for “the cheapest 5-bedroom in Chicago.”</li>
                <li>Vague on guest count, occasion, or who’s coming.</li>
                <li>Treating the home as a venue for a bigger event than the headcount suggests.</li>
                <li>Pushing back on house rules during the inquiry.</li>
                <li>Bachelorette / bachelor weekends that feel more rowdy than celebratory.</li>
                <li>Anyone calling it a “rental,” a “listing,” or a “party house.”</li>
              </ul>
            </div>
          </div>

          <p className={styles.bodyText} style={{ marginTop: 24 }}>
            When a lead is borderline, the right move is almost always to ask
            one more question before quoting. The occasion, the headcount, the
            ages, who’s planning — every additional answer either qualifies them
            into the dream column or quietly out of it.
          </p>
        </section>

        {/* ───── 4. How we sound ───── */}
        <section id="voice" className={`${styles.section} ${styles.anchor}`}>
          <div className={styles.sectionEyebrow}>Chapter four</div>
          <h2 className={styles.sectionTitle}>How we sound</h2>
          <p className={styles.sectionLead}>
            The brand voice is the part that’s easiest to get wrong, because
            hospitality marketing has a default tone — eager, urgent,
            transactional — and we are not that. Three pillars, then a
            vocabulary, then some examples.
          </p>

          <div className={styles.voicePillars}>
            <div className={styles.voicePillar}>
              <div className={styles.voicePillarLabel}>Pillar one</div>
              <p className={styles.voicePillarText}>Confident without bragging.</p>
            </div>
            <div className={styles.voicePillar}>
              <div className={styles.voicePillarLabel}>Pillar two</div>
              <p className={styles.voicePillarText}>Warm without being cheesy.</p>
            </div>
            <div className={styles.voicePillar}>
              <div className={styles.voicePillarLabel}>Pillar three</div>
              <p className={styles.voicePillarText}>Editorial, never aggressive.</p>
            </div>
          </div>

          <p className={styles.bodyText}>
            The mental model: we’re the friend who always finds the best spot.
            We’re not selling — we’re introducing. The work isn’t to convince
            anyone; it’s to let the right people recognize that they’ve found
            something they’ve been looking for.
          </p>

          <div className={styles.wordsRow}>
            <div className={`${styles.wordsCol} ${styles.use}`}>
              <div className={styles.wordsLabel}>Words we use</div>
              <ul className={styles.wordsList}>
                <li>home</li>
                <li>crew</li>
                <li>celebration</li>
                <li>weekend</li>
                <li>stay</li>
                <li>guests</li>
                <li>found</li>
              </ul>
            </div>
            <div className={`${styles.wordsCol} ${styles.avoid}`}>
              <div className={styles.wordsLabel}>Words we don’t</div>
              <ul className={styles.wordsList}>
                <li>rental</li>
                <li>listing</li>
                <li>Airbnb</li>
                <li>party house</li>
                <li>book now</li>
                <li>customer</li>
                <li>property</li>
              </ul>
            </div>
          </div>

          <div className={styles.heroLines}>
            <div className={styles.heroLinesLabel}>Hero lines we love</div>
            <p className={styles.heroLineQuote}>“You just hit the Jackpot.”</p>
            <p className={styles.heroLineQuote}>“You found something special.”</p>
            <p className={styles.heroLineQuote}>“Stop scrolling. You found it.”</p>
          </div>

          <h3 className={styles.sectionTitle} style={{ fontSize: 22 }}>Before &amp; after</h3>
          <p className={styles.bodyText}>
            Three quick rewrites that show the difference between the default
            voice and ours.
          </p>

          <div className={styles.swap}>
            <div className={`${styles.swapCol} ${styles.bad}`}>
              <div className={styles.swapTag}>Off-brand</div>
              <p className={styles.swapText}>
                “Book our 5-bedroom rental today — last weekend in May still
                available! Don’t miss out.”
              </p>
            </div>
            <div className={`${styles.swapCol} ${styles.good}`}>
              <div className={styles.swapTag}>On-brand</div>
              <p className={styles.swapText}>
                “The last May weekend is still open. If your crew is the right
                fit, we’d love to host it.”
              </p>
            </div>
          </div>

          <div className={styles.swap}>
            <div className={`${styles.swapCol} ${styles.bad}`}>
              <div className={styles.swapTag}>Off-brand</div>
              <p className={styles.swapText}>
                “Looking for the perfect Airbnb for your party? We have great
                rates and amazing amenities!”
              </p>
            </div>
            <div className={`${styles.swapCol} ${styles.good}`}>
              <div className={styles.swapTag}>On-brand</div>
              <p className={styles.swapText}>
                “If you’re planning a real celebration — birthday, reunion,
                bachelorette — this is the home we built for it.”
              </p>
            </div>
          </div>

          <div className={styles.swap}>
            <div className={`${styles.swapCol} ${styles.bad}`}>
              <div className={styles.swapTag}>Off-brand</div>
              <p className={styles.swapText}>
                “Hi! Following up on your inquiry. Are you still interested?
                We’d love to have you!”
              </p>
            </div>
            <div className={`${styles.swapCol} ${styles.good}`}>
              <div className={styles.swapTag}>On-brand</div>
              <p className={styles.swapText}>
                “Circling back — your dates are still ours to hold. Tell me a
                little more about the occasion and we’ll go from there.”
              </p>
            </div>
          </div>
        </section>

        {/* ───── 5. How we sell ───── */}
        <section id="sell" className={`${styles.section} ${styles.anchor}`}>
          <div className={styles.sectionEyebrow}>Chapter five</div>
          <h2 className={styles.sectionTitle}>How we sell</h2>
          <p className={styles.sectionLead}>
            The way The Jackpot makes money is different from most
            hospitality brands, and the difference shapes every decision we
            make in sales and marketing. Four operating principles.
          </p>

          <div className={styles.beats}>
            <div className={styles.beat}>
              <div className={styles.beatNum}>01</div>
              <h3 className={styles.beatTitle}>Direct first, always.</h3>
              <p className={styles.beatText}>
                Every story we tell points back to booking direct with us.
                Platforms exist, but the brand’s center of gravity is the
                site. When a guest is comparing, the answer is always “book
                here — it’s better here.”
              </p>
            </div>
            <div className={styles.beat}>
              <div className={styles.beatNum}>02</div>
              <h3 className={styles.beatTitle}>Quality over volume.</h3>
              <p className={styles.beatText}>
                We’d rather host fewer of the right stays than chase every
                lead. A wrong booking costs us the property, the brand, and
                the next three months of momentum. Price is the first
                quality filter — and that’s by design.
              </p>
            </div>
            <div className={styles.beat}>
              <div className={styles.beatNum}>03</div>
              <h3 className={styles.beatTitle}>Abe personally closes.</h3>
              <p className={styles.beatText}>
                Most bookings get a personal reply from Abe. The marketing
                job is to make the inquiry feel chosen and informed by the
                time it lands. Your role is to set him up to close, not to
                replace that step.
              </p>
            </div>
            <div className={styles.beat}>
              <div className={styles.beatNum}>04</div>
              <h3 className={styles.beatTitle}>Editorial, never aggressive.</h3>
              <p className={styles.beatText}>
                Countdown timers, fake scarcity, “BOOK NOW” energy — none of
                it. Anything that would feel embarrassing to read aloud at a
                dinner party is off-limits, even if it would convert in the
                short term.
              </p>
            </div>
          </div>

          <p className={styles.bodyText} style={{ marginTop: 28 }}>
            The exact pricing structure, the peer set, the margins, and how we
            think about discounting — that’s a separate conversation with Abe,
            in person. Once you’ve got the brand and the guest internalized,
            those numbers make a lot more sense.
          </p>
        </section>

        {/* ───── 6. Brand visual rules ───── */}
        <section id="brand" className={`${styles.section} ${styles.anchor}`}>
          <div className={styles.sectionEyebrow}>Chapter six</div>
          <h2 className={styles.sectionTitle}>The brand, on one page</h2>
          <p className={styles.sectionLead}>
            The full design system lives at <em>/brand/docs/design-system.md</em>.
            This is the short version — what you’ll need most often when
            you’re picking a color, writing a caption, or briefing a designer.
          </p>

          <h3 className={styles.sectionTitle} style={{ fontSize: 20, marginTop: 28 }}>The palette</h3>
          <div className={styles.swatchGrid}>
            {PALETTE.map((c) => (
              <div key={c.name} className={styles.swatch}>
                <div className={styles.swatchChip} style={{ background: c.hex }} aria-hidden="true" />
                <div className={styles.swatchMeta}>
                  <p className={styles.swatchName}>{c.name}</p>
                  <p className={styles.swatchHex}>{c.hex}</p>
                </div>
              </div>
            ))}
          </div>
          <p className={styles.bodyText}>
            Gold and peach are for headlines and accents. Linen is the soft
            secondary background. Olive is the text color — never black,
            never gray. Sage and terra are accent moments. The gradient (gold
            into peach, always at 135°) is reserved for hero surfaces.
          </p>

          <h3 className={styles.sectionTitle} style={{ fontSize: 20, marginTop: 32 }}>The type pair</h3>
          <div className={styles.typePair}>
            <div className={styles.typeCard}>
              <div className={styles.typeLabel}>Display — Cormorant Garamond</div>
              <p className={styles.typeSampleDisplay}>You found something special.</p>
              <p className={styles.typeRole}>Headlines, taglines, stat numbers, the word JACKPOT.</p>
            </div>
            <div className={styles.typeCard}>
              <div className={styles.typeLabel}>Body — Outfit</div>
              <p className={styles.typeSampleBody}>Crew, celebration, weekend — words we live in.</p>
              <p className={styles.typeRole}>Body copy, captions, buttons, nav, labels, anything functional.</p>
            </div>
          </div>

          <h3 className={styles.sectionTitle} style={{ fontSize: 20, marginTop: 8 }}>The starburst</h3>
          <p className={styles.bodyText}>
            The starburst is our signature mark — a sunburst with gold lines
            and peach-tipped edges. It runs at three intensities.
          </p>
          <div className={styles.starRow}>
            <div className={styles.starCell}>
              <Starburst size={36} tier={8} />
              <div className={styles.starCaption}>100% — logo</div>
            </div>
            <div className={styles.starCell}>
              <Starburst size={36} tier={6} axisOpacity={0.5} diagOpacity={0.3} terOpacity={0.2} />
              <div className={styles.starCaption}>30% — accent</div>
            </div>
            <div className={styles.starCell}>
              <Starburst size={36} tier={4} axisOpacity={0.12} diagOpacity={0.08} />
              <div className={styles.starCaption}>5% — watermark</div>
            </div>
          </div>

          <h3 className={styles.sectionTitle} style={{ fontSize: 20, marginTop: 8 }}>The hard rules</h3>
          <ul className={styles.ruleList}>
            <li>
              <strong>Never go dark.</strong>
              The brand is always warm and light. No black, no espresso, no
              gray. The darkest background we use is terracotta, and even that
              glows.
            </li>
            <li>
              <strong>Never go cool.</strong>
              No blue, no silver, no cool-toned grays. Every neutral skews
              warm. If a swatch looks “modern” or “tech,” it’s wrong for us.
            </li>
            <li>
              <strong>Never swap the fonts.</strong>
              Cormorant for display. Outfit for function. Don’t put body copy
              in Cormorant; don’t put headlines in Outfit.
            </li>
            <li>
              <strong>Never hardcode.</strong>
              On the site, every color, font, and spacing value is a token.
              In creative work, every value traces back to the design system.
              If you can’t find the value in the docs, ask before inventing.
            </li>
          </ul>
        </section>

        {/* ───── 7. Inquiries flow ───── */}
        <section id="flow" className={`${styles.section} ${styles.anchor}`}>
          <div className={styles.sectionEyebrow}>Chapter seven</div>
          <h2 className={styles.sectionTitle}>How an inquiry moves</h2>
          <p className={styles.sectionLead}>
            From the moment a guest fills out the funnel to the moment a stay
            is confirmed, the path is short and very human. Four steps.
          </p>

          <div className={styles.flow}>
            <div className={styles.flowStep}>
              <div className={styles.flowStepNum}>Step 01</div>
              <h3 className={styles.flowStepTitle}>Funnel</h3>
              <p className={styles.flowStepText}>
                Guest picks dates, headcount, occasion. The site computes a
                live quote behind the scenes.
              </p>
              <FlowArrow />
            </div>
            <div className={styles.flowStep}>
              <div className={styles.flowStepNum}>Step 02</div>
              <h3 className={styles.flowStepTitle}>Lands</h3>
              <p className={styles.flowStepText}>
                Inquiry hits Supabase, an email goes to Abe, and the row shows
                up in the Inquiries tab here in the admin.
              </p>
              <FlowArrow />
            </div>
            <div className={styles.flowStep}>
              <div className={styles.flowStepNum}>Step 03</div>
              <h3 className={styles.flowStepTitle}>Reply</h3>
              <p className={styles.flowStepText}>
                Abe replies personally — usually a short, warm message that
                opens a real conversation, not a sales pitch.
              </p>
              <FlowArrow />
            </div>
            <div className={styles.flowStep}>
              <div className={styles.flowStepNum}>Step 04</div>
              <h3 className={styles.flowStepTitle}>Closed</h3>
              <p className={styles.flowStepText}>
                Booking is confirmed, payment is taken, and the inquiry
                mirrors into the VenueMBA CRM for the operational handoff.
              </p>
            </div>
          </div>

          <p className={styles.bodyText} style={{ marginTop: 24 }}>
            Your work, in the early weeks, lives upstream of step one (driving
            the right inquiries) and beside step three (making sure no warm
            lead goes cold while Abe is closing the others). We’ll define the
            exact handoff together in your first week.
          </p>
        </section>

        {/* ───── 8. Tools ───── */}
        <section id="tools" className={`${styles.section} ${styles.anchor}`}>
          <div className={styles.sectionEyebrow}>Chapter eight</div>
          <h2 className={styles.sectionTitle}>Tools you’ll meet</h2>
          <p className={styles.sectionLead}>
            A short list of the systems we touch. Logins, access, and
            walk-throughs happen in your 1:1 with Abe — this is just so the
            names aren’t strangers.
          </p>

          <div className={styles.toolGrid}>
            <div className={styles.toolCard}>
              <h3 className={styles.toolName}>Admin Panel</h3>
              <p className={styles.toolDesc}>
                This portal. Overview, Inquiries, Monthly — the daily
                operating dashboard. Onboarding lives here too (you’re on it).
              </p>
            </div>
            <div className={styles.toolCard}>
              <h3 className={styles.toolName}>Supabase</h3>
              <p className={styles.toolDesc}>
                Where the data lives — inquiries, quotes, bookings. Most of
                the time the admin view is enough; Supabase is for when we
                need the raw row.
              </p>
            </div>
            <div className={styles.toolCard}>
              <h3 className={styles.toolName}>PostHog</h3>
              <p className={styles.toolDesc}>
                Behavior — which pages, which funnels, where guests drop off.
                Open it when you want to understand <em>why</em> a campaign
                worked or didn’t.
              </p>
            </div>
            <div className={styles.toolCard}>
              <h3 className={styles.toolName}>VenueMBA</h3>
              <p className={styles.toolDesc}>
                The CRM that runs the operational side of confirmed bookings.
                Finalized inquiries mirror over automatically.
              </p>
            </div>
            <div className={styles.toolCard}>
              <h3 className={styles.toolName}>Pricelabs</h3>
              <p className={styles.toolDesc}>
                The pricing engine — daily rates, seasonality, demand signals.
                Mostly Abe’s surface; you’ll only touch it when we’re testing
                a campaign window.
              </p>
            </div>
            <div className={styles.toolCard}>
              <h3 className={styles.toolName}>Gmail</h3>
              <p className={styles.toolDesc}>
                Where inquiry emails land and where Abe sends most replies.
                Brand voice rules apply to email the same as everywhere else.
              </p>
            </div>
          </div>
        </section>

        {/* ───── 9. Where to ask ───── */}
        <section className={styles.section}>
          <div className={styles.sectionEyebrow}>Last note</div>
          <h2 className={styles.sectionTitle}>When in doubt, ask Abe.</h2>
          <p className={styles.bodyText}>
            On anything brand, pricing, guest-fit, or “should I send this” —
            Abe is the source of truth. The Jackpot is a small operation by
            design; the loop is meant to be tight, and questions are how the
            voice stays consistent in the first months. Nobody’s ever been in
            trouble for asking. The opposite, regularly.
          </p>
          <p className={styles.bodyText}>
            Read this page again in a few weeks. The parts that felt
            theoretical the first time will sound obvious. That’s the goal.
          </p>
        </section>

        {/* ───── Closing flourish ───── */}
        <div className={styles.closing}>
          <div className={styles.closingDivider}>
            <Starburst size={18} tier={8} />
          </div>
          <p className={styles.closingText}>Welcome aboard.</p>
          <p className={styles.closingSub}>The Jackpot · Chicago</p>
        </div>
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <svg className={styles.flowArrow} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7 L11 7 M8 4 L11 7 L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
