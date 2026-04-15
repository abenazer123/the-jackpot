/**
 * ChicagoOutline — the LocationSection's map illustration.
 *
 * Warm-dark canvas with a street grid, a suggestion of Lake Michigan, and
 * routes for I-90 and the CTA Blue Line. Each destination (O'Hare, Downtown,
 * Wrigley, Logan/Wicker, Lincoln Square, a Blue Line stop) is labeled with
 * its drive/walk time so the map carries the data that used to live in a
 * separate typographic list. The property is marked with a gold starburst
 * pin at the center of a subtly pulsing halo.
 *
 * Server component; module CSS owns the wrapper sizing + the halo pulse
 * animation (disabled under prefers-reduced-motion).
 */

import styles from "./ChicagoOutline.module.css";

export function ChicagoOutline() {
  return (
    <svg
      viewBox="0 0 680 520"
      role="img"
      aria-label="Map of Chicago showing The Jackpot in North Park with drive times to O'Hare, downtown, Wrigley Field, the Blue Line, and Wicker Park"
      className={styles.map}
    >
      {/* Dark warm background */}
      <rect x="0" y="0" width="680" height="520" fill="#1c1a16" rx="0" />

      {/* Street grid — faint horizontals */}
      <line x1="0" y1="60" x2="530" y2="60" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="0" y1="100" x2="520" y2="100" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="0" y1="140" x2="515" y2="140" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="0" y1="180" x2="510" y2="180" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="30" y1="220" x2="508" y2="220" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="40" y1="260" x2="510" y2="260" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="50" y1="300" x2="515" y2="300" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="60" y1="340" x2="520" y2="340" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="70" y1="380" x2="525" y2="380" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="80" y1="420" x2="530" y2="420" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="90" y1="460" x2="535" y2="460" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="100" y1="500" x2="540" y2="500" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      {/* Street grid — faint verticals */}
      <line x1="60" y1="0" x2="60" y2="520" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="110" y1="0" x2="110" y2="520" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="160" y1="0" x2="160" y2="520" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="210" y1="0" x2="210" y2="520" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="260" y1="0" x2="260" y2="520" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="310" y1="0" x2="310" y2="520" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="360" y1="0" x2="360" y2="520" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="410" y1="0" x2="410" y2="520" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="460" y1="0" x2="460" y2="520" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      <line x1="510" y1="0" x2="510" y2="520" stroke="#d4a930" strokeWidth="0.3" opacity="0.08" />
      {/* Emphasized axes */}
      <line x1="0" y1="180" x2="510" y2="180" stroke="#d4a930" strokeWidth="0.5" opacity="0.1" />
      <line x1="0" y1="340" x2="520" y2="340" stroke="#d4a930" strokeWidth="0.5" opacity="0.1" />
      <line x1="260" y1="0" x2="260" y2="520" stroke="#d4a930" strokeWidth="0.5" opacity="0.1" />
      <line x1="410" y1="0" x2="410" y2="520" stroke="#d4a930" strokeWidth="0.5" opacity="0.1" />

      {/* Lake Michigan */}
      <path
        d="M540 0 L680 0 L680 520 L540 520 Q500 420, 510 340 Q520 260, 505 180 Q495 100, 540 0Z"
        fill="#d4c4a0"
        opacity="0.05"
      />
      <path
        d="M540 0 Q495 100, 505 180 Q520 260, 510 340 Q500 420, 540 520"
        fill="none"
        stroke="#d4a930"
        strokeWidth="1.2"
        opacity="0.25"
      />
      <text
        x="595"
        y="275"
        fontFamily="Cormorant Garamond, serif"
        fontSize="12"
        fontStyle="italic"
        fill="#c0a060"
        opacity="0.35"
        textAnchor="middle"
        transform="rotate(8, 595, 275)"
      >
        Lake Michigan
      </text>

      {/* I-90 Expressway */}
      <path
        d="M40 65 Q150 100, 250 165 Q310 205, 350 285 Q390 365, 460 440"
        fill="none"
        stroke="#d4a930"
        strokeWidth="2.5"
        opacity="0.25"
        strokeLinecap="round"
      />
      <path
        d="M40 65 Q150 100, 250 165 Q310 205, 350 285 Q390 365, 460 440"
        fill="none"
        stroke="#d4a930"
        strokeWidth="1"
        opacity="0.45"
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
      <text
        x="135"
        y="88"
        fontFamily="Outfit, sans-serif"
        fontSize="10"
        fill="#c0a050"
        opacity="0.5"
        letterSpacing="1.5"
        fontWeight="400"
      >
        I-90 EXPRESSWAY
      </text>

      {/* CTA Blue Line */}
      <path
        d="M55 78 Q185 135, 290 195 Q360 240, 400 340 Q425 390, 455 445"
        fill="none"
        stroke="#6a9fc4"
        strokeWidth="2"
        opacity="0.45"
        strokeLinecap="round"
      />
      <path
        d="M55 78 Q185 135, 290 195 Q360 240, 400 340 Q425 390, 455 445"
        fill="none"
        stroke="#6a9fc4"
        strokeWidth="1.2"
        opacity="0.6"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
      <text
        x="195"
        y="130"
        fontFamily="Outfit, sans-serif"
        fontSize="9"
        fill="#6a9fc4"
        opacity="0.65"
        letterSpacing="1"
        fontWeight="400"
      >
        CTA BLUE LINE
      </text>

      {/* Outer radius circle with label */}
      <circle
        cx="330"
        cy="195"
        r="130"
        fill="none"
        stroke="#d4a930"
        strokeWidth="0.5"
        opacity="0.1"
        strokeDasharray="4 4"
      />
      <text
        x="462"
        y="152"
        fontFamily="Outfit, sans-serif"
        fontSize="8"
        fill="#c0a050"
        opacity="0.35"
        letterSpacing="1.5"
      >
        15 MIN RADIUS
      </text>

      {/* Inner radius ring */}
      <circle cx="330" cy="195" r="85" fill="#d4a930" opacity="0.03" />
      <circle
        cx="330"
        cy="195"
        r="85"
        fill="none"
        stroke="#d4a930"
        strokeWidth="0.4"
        opacity="0.1"
        strokeDasharray="3 3"
      />

      {/* Compass */}
      <g transform="translate(632, 40)">
        <line x1="0" y1="12" x2="0" y2="-12" stroke="#c0a050" strokeWidth="0.8" opacity="0.35" />
        <line x1="-1.5" y1="-7" x2="0" y2="-12" stroke="#c0a050" strokeWidth="0.8" opacity="0.35" />
        <line x1="1.5" y1="-7" x2="0" y2="-12" stroke="#c0a050" strokeWidth="0.8" opacity="0.35" />
        <text
          x="0"
          y="-17"
          fontFamily="Outfit, sans-serif"
          fontSize="9"
          fill="#c0a050"
          opacity="0.35"
          textAnchor="middle"
          letterSpacing="1"
          fontWeight="500"
        >
          N
        </text>
      </g>

      {/* O'Hare Airport */}
      <g>
        <rect
          x="72"
          y="84"
          width="14"
          height="14"
          rx="2"
          fill="none"
          stroke="#d4a930"
          strokeWidth="0.8"
          opacity="0.6"
        />
        <line x1="72" y1="91" x2="86" y2="91" stroke="#d4a930" strokeWidth="0.5" opacity="0.6" />
        <text
          x="68"
          y="114"
          fontFamily="Outfit, sans-serif"
          fontSize="10"
          fill="#c0a050"
          fontWeight="400"
          letterSpacing="0.5"
        >
          O&rsquo;Hare Airport
        </text>
        <text
          x="68"
          y="134"
          fontFamily="Cormorant Garamond, serif"
          fontSize="24"
          fill="#e8b923"
          fontWeight="600"
        >
          15
        </text>
        <text
          x="97"
          y="134"
          fontFamily="Outfit, sans-serif"
          fontSize="9"
          fill="#c0a050"
          letterSpacing="1.5"
        >
          MIN
        </text>
      </g>

      {/* Downtown / The Loop */}
      <g>
        <rect
          x="448"
          y="412"
          width="6"
          height="14"
          rx="1"
          fill="none"
          stroke="#d4a930"
          strokeWidth="0.7"
          opacity="0.6"
        />
        <rect
          x="456"
          y="408"
          width="5"
          height="18"
          rx="1"
          fill="none"
          stroke="#d4a930"
          strokeWidth="0.7"
          opacity="0.6"
        />
        <rect
          x="463"
          y="414"
          width="6"
          height="12"
          rx="1"
          fill="none"
          stroke="#d4a930"
          strokeWidth="0.7"
          opacity="0.6"
        />
        <text
          x="458"
          y="448"
          fontFamily="Outfit, sans-serif"
          fontSize="10"
          fill="#c0a050"
          textAnchor="middle"
          fontWeight="400"
          letterSpacing="0.5"
        >
          Downtown / Loop
        </text>
        <text
          x="441"
          y="472"
          fontFamily="Cormorant Garamond, serif"
          fontSize="24"
          fill="#e8b923"
          fontWeight="600"
        >
          16
        </text>
        <text
          x="470"
          y="472"
          fontFamily="Outfit, sans-serif"
          fontSize="9"
          fill="#c0a050"
          letterSpacing="1.5"
        >
          MIN
        </text>
      </g>

      {/* Wrigley Field */}
      <g>
        <circle cx="430" cy="178" r="5" fill="none" stroke="#a0be8a" strokeWidth="0.8" />
        <circle cx="430" cy="178" r="2" fill="#a0be8a" opacity="0.5" />
        <text
          x="430"
          y="163"
          fontFamily="Outfit, sans-serif"
          fontSize="10"
          fill="#a0be8a"
          textAnchor="middle"
          fontWeight="400"
        >
          Wrigley Field
        </text>
        <text
          x="416"
          y="148"
          fontFamily="Cormorant Garamond, serif"
          fontSize="20"
          fill="#a0be8a"
          fontWeight="600"
        >
          15
        </text>
        <text
          x="440"
          y="148"
          fontFamily="Outfit, sans-serif"
          fontSize="8"
          fill="#a0be8a"
          letterSpacing="1.5"
        >
          MIN
        </text>
      </g>

      {/* Lincoln Square */}
      <g>
        <circle cx="380" cy="185" r="3" fill="none" stroke="#c0a050" strokeWidth="0.7" />
        <circle cx="380" cy="185" r="1.2" fill="#c0a050" opacity="0.5" />
        <text
          x="393"
          y="180"
          fontFamily="Outfit, sans-serif"
          fontSize="9"
          fill="#c0a050"
          fontWeight="400"
          opacity="0.7"
        >
          Lincoln Sq
        </text>
        <text
          x="393"
          y="192"
          fontFamily="Cormorant Garamond, serif"
          fontSize="14"
          fill="#e8b923"
          opacity="0.7"
          fontWeight="600"
        >
          5
        </text>
        <text
          x="404"
          y="192"
          fontFamily="Outfit, sans-serif"
          fontSize="7"
          fill="#c0a050"
          letterSpacing="1"
          opacity="0.7"
        >
          MIN
        </text>
      </g>

      {/* Logan Square / Wicker Park */}
      <g>
        <circle cx="370" cy="320" r="4" fill="none" stroke="#d4a060" strokeWidth="0.8" />
        <circle cx="370" cy="320" r="1.5" fill="#d4a060" opacity="0.5" />
        <text
          x="370"
          y="342"
          fontFamily="Outfit, sans-serif"
          fontSize="10"
          fill="#d4a060"
          textAnchor="middle"
          fontWeight="400"
        >
          Logan Sq &middot; Wicker Pk
        </text>
        <text
          x="355"
          y="359"
          fontFamily="Cormorant Garamond, serif"
          fontSize="18"
          fill="#e8b923"
          fontWeight="600"
        >
          12
        </text>
        <text
          x="377"
          y="359"
          fontFamily="Outfit, sans-serif"
          fontSize="8"
          fill="#d4a060"
          letterSpacing="1.5"
        >
          MIN
        </text>
      </g>

      {/* Blue Line station */}
      <g>
        <circle cx="310" cy="240" r="4" fill="#6a9fc4" opacity="0.6" />
        <circle cx="310" cy="240" r="6.5" fill="none" stroke="#6a9fc4" strokeWidth="0.6" opacity="0.4" />
        <line
          x1="304"
          y1="243"
          x2="210"
          y2="270"
          stroke="#6a9fc4"
          strokeWidth="0.5"
          opacity="0.3"
          strokeDasharray="2 2"
        />
        <text
          x="205"
          y="268"
          fontFamily="Outfit, sans-serif"
          fontSize="9.5"
          fill="#6a9fc4"
          textAnchor="end"
          fontWeight="400"
          opacity="0.75"
        >
          Blue Line stop
        </text>
        <text
          x="170"
          y="283"
          fontFamily="Cormorant Garamond, serif"
          fontSize="16"
          fill="#6a9fc4"
          opacity="0.75"
          fontWeight="600"
        >
          9
        </text>
        <text
          x="182"
          y="283"
          fontFamily="Outfit, sans-serif"
          fontSize="8"
          fill="#6a9fc4"
          letterSpacing="1"
          opacity="0.75"
        >
          MIN WALK
        </text>
      </g>

      {/* Property marker — gold starburst with pulsing halos */}
      <g>
        <circle className={styles.haloOuter} cx="330" cy="195" r="22" fill="#d4a930" />
        <circle className={styles.haloInner} cx="330" cy="195" r="14" fill="#d4a930" />
        <line x1="330" y1="177" x2="330" y2="182" stroke="#e8b923" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="330" y1="208" x2="330" y2="213" stroke="#e8b923" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="312" y1="195" x2="317" y2="195" stroke="#e8b923" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="343" y1="195" x2="348" y2="195" stroke="#e8b923" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="317" y1="183" x2="320" y2="186" stroke="#e8b923" strokeWidth="1" strokeLinecap="round" />
        <line x1="340" y1="204" x2="343" y2="207" stroke="#e8b923" strokeWidth="1" strokeLinecap="round" />
        <line x1="343" y1="183" x2="340" y2="186" stroke="#e8b923" strokeWidth="1" strokeLinecap="round" />
        <line x1="317" y1="207" x2="320" y2="204" stroke="#e8b923" strokeWidth="1" strokeLinecap="round" />
        <circle cx="330" cy="195" r="4.5" fill="#e8b923" />
        <circle cx="330" cy="195" r="2" fill="#1c1a16" />
      </g>

      {/* Property label */}
      <text
        x="330"
        y="228"
        fontFamily="Cormorant Garamond, serif"
        fontSize="15"
        fontStyle="italic"
        fill="#e8b923"
        textAnchor="middle"
        fontWeight="600"
      >
        The Jackpot
      </text>
      <text
        x="330"
        y="242"
        fontFamily="Outfit, sans-serif"
        fontSize="8.5"
        fill="#c0a050"
        textAnchor="middle"
        letterSpacing="2.5"
        fontWeight="300"
      >
        NORTH PARK &middot; CHICAGO
      </text>
    </svg>
  );
}
