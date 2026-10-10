import { useId } from 'react';
export function WonderArt({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg className={className} viewBox="0 0 480 300" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id={uid + 'planet'}
          x1="200"
          y1="65"
          x2="340"
          y2="220"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#B4A4FB" />
          <stop offset="1" stopColor="#7762D4" />
        </linearGradient>
        <linearGradient id={uid + 'mint'} x1="80" y1="160" x2="100" y2="225">
          <stop stopColor="#8FDCC6" />
          <stop offset="1" stopColor="#5DBDA4" />
        </linearGradient>
        <filter id={uid + 'shadow'} x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#6952AF" floodOpacity=".12" />
        </filter>
      </defs>
      <ellipse
        cx="270"
        cy="170"
        rx="168"
        ry="97"
        stroke="#D8CFF1"
        strokeDasharray="4 8"
        transform="rotate(-19 270 170)"
      />
      <circle
        cx="270"
        cy="147"
        r="91"
        fill={'url(#' + uid + 'planet)'}
        filter={'url(#' + uid + 'shadow)'}
      />
      <path
        d="M209 89c15-14 33-18 48-13l-7 19 16 18-10 22-27 1-18 22-16-18-9-17 12-5z"
        fill="#CEC1FF"
        opacity=".75"
      />
      <path
        d="M300 112l26-9 24 29-14 18-26-3-7 16-15-6-10-26zM274 186l19-8 24 11-11 29-30 13-15-18z"
        fill="#D3C7FF"
        opacity=".6"
      />
      <ellipse
        cx="271"
        cy="161"
        rx="140"
        ry="29"
        transform="rotate(-23 271 161)"
        stroke="#E7BA98"
        strokeWidth="15"
      />
      <path
        d="M179 138c-45 32-56 48-36 55 40 13 157-30 216-62"
        stroke="#F6CEAF"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <g transform="translate(343 35) rotate(20)" filter={'url(#' + uid + 'shadow)'}>
        <path d="M20 16Q47-20 67 14v68H20z" fill="#FFF" />
        <path d="M20 20Q45-20 67 20" fill="#FE937B" />
        <path d="M20 57L5 85l15-3M67 57l16 28-16-3" fill="#987EE9" />
        <circle cx="44" cy="40" r="13" fill="#AEE5E2" stroke="#D1D3F2" strokeWidth="5" />
        <path d="M30 86l12 34 14-34" fill="#FACB7B" />
        <path d="M37 86l5 19 7-19" fill="#FF9C77" />
      </g>
      <g transform="translate(58 56) rotate(-13)" filter={'url(#' + uid + 'shadow)'}>
        <rect width="90" height="72" rx="16" fill="white" />
        <path
          d="M22 30h19m-10-9v18M54 26l13 13m0-13L54 39"
          stroke="#9075DF"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M23 52h42" stroke="#DBD2F4" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g transform="translate(54 179) rotate(-12)">
        <rect
          width="100"
          height="86"
          rx="19"
          fill={'url(#' + uid + 'mint)'}
          filter={'url(#' + uid + 'shadow)'}
        />
        <ellipse cx="50" cy="43" rx="32" ry="13" stroke="white" strokeWidth="2.5" />
        <ellipse
          cx="50"
          cy="43"
          rx="32"
          ry="13"
          stroke="white"
          strokeWidth="2.5"
          transform="rotate(60 50 43)"
        />
        <ellipse
          cx="50"
          cy="43"
          rx="32"
          ry="13"
          stroke="white"
          strokeWidth="2.5"
          transform="rotate(120 50 43)"
        />
        <circle cx="50" cy="43" r="6" fill="#FFF4B8" />
      </g>
      <g transform="translate(342 213) rotate(8)" filter={'url(#' + uid + 'shadow)'}>
        <path d="M0 12l45-7 46 7v54l-45-7-45 7z" fill="#FFF" />
        <path d="M45 5v54" stroke="#D3C7EF" strokeWidth="2" />
        <path
          d="M11 27l23-3m-23 14l23-3m23-7l22 3m-22 9l22 3"
          stroke="#B3A0E3"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      {[
        [191, 37, 6],
        [417, 171, 7],
        [169, 231, 5],
        [43, 146, 5],
        [317, 273, 5],
        [411, 280, 4],
      ].map(([x, y, r], i) => (
        <path
          key={i}
          d={`M${x} ${y - r}v${r * 2}M${x - r} ${y}h${r * 2}`}
          stroke={i % 2 ? '#C1B1E9' : '#E1AB70'}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
      <circle cx="158" cy="155" r="4" fill="#AE93E2" />
      <circle cx="427" cy="116" r="4" fill="#F3BA8A" />
    </svg>
  );
}
export function Mascot({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M22 43l-6-19 24 8c17-7 39-1 47 16 9 19 2 39-19 44-24 6-49-6-48-27z" fill="#9B81EC" />
      <path d="M76 27l7-8 3 22" fill="#9B81EC" />
      <ellipse cx="50" cy="61" rx="26" ry="22" fill="#C2B0FA" />
      <ellipse cx="39" cy="50" rx="9" ry="12" fill="white" />
      <ellipse cx="64" cy="50" rx="9" ry="12" fill="white" />
      <ellipse cx="42" cy="52" rx="4" ry="6" fill="#392E62" />
      <ellipse cx="61" cy="52" rx="4" ry="6" fill="#392E62" />
      <path d="M48 62l4 4 4-4" stroke="#392E62" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="30" cy="64" rx="6" ry="3" fill="#EFACBF" />
      <ellipse cx="71" cy="64" rx="6" ry="3" fill="#EFACBF" />
      <path d="M31 84l-4 10m39-10l5 10" stroke="#9B81EC" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}
export function LessonArt({ kind, className = '' }: { kind: string; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const heart = /heart/i.test(kind),
    history = /merdeka|malay|independence|history/i.test(kind),
    pizza = /fraction|math/i.test(kind),
    plant = /plant|photosynt/i.test(kind);
  return (
    <svg className={className} viewBox="0 0 300 180" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={uid} x1="105" y1="40" x2="198" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor={heart ? '#F78D8F' : '#BEA8F5'} />
          <stop offset="1" stopColor={heart ? '#DF5F70' : '#8D77CC'} />
        </linearGradient>
      </defs>
      {heart ? (
        <>
          <ellipse cx="149" cy="157" rx="52" ry="8" fill="#A8DCD0" opacity=".5" />
          <path
            d="M149 49c-32-35-67-6-51 31 7 17 23 33 48 55 4 3 8 1 12-3 28-25 50-49 42-76-6-20-33-23-51-7z"
            fill={'url(#' + uid + ')'}
          />
          <path
            d="M140 48V22c0-7 12-7 12 0v25m7 3V23c0-7 12-7 12 0v28"
            stroke="#EB747D"
            strokeWidth="10"
          />
          <path
            d="M123 59c12 17 14 39 26 60M172 67c-20 12-22 33-21 52"
            stroke="#FCB0AD"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M51 95h26l8-13 9 25 8-13h22"
            stroke="#72B4A4"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="226" cy="62" r="13" fill="white" opacity=".65" />
          <path d="M220 62h12m-6-6v12" stroke="#64AC98" strokeWidth="2.5" />
        </>
      ) : pizza ? (
        <>
          <ellipse cx="149" cy="151" rx="67" ry="10" fill="#ECB89A" opacity=".4" />
          <g transform="translate(151 83) rotate(-15)">
            <circle r="64" fill="#D6954F" />
            <circle r="56" fill="#FADE8F" />
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return (
                <line
                  key={i}
                  x1="0"
                  y1="0"
                  x2={60 * Math.cos(a)}
                  y2={60 * Math.sin(a)}
                  stroke="#D9A269"
                  strokeWidth="2"
                />
              );
            })}
            {[
              [20, 20],
              [-27, 15],
              [20, -27],
              [-28, -24],
              [1, 38],
              [39, -2],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="7" fill="#E88368" />
            ))}
            <path
              d="M0 0L45 45a64 64 0 0 1-45 19z"
              fill="#FFEEC5"
              stroke="#F8F3EC"
              strokeWidth="3"
            />
          </g>
          <rect x="218" y="95" width="40" height="45" rx="9" fill="white" />
          <text x="238" y="123" textAnchor="middle" fill="#BA7547" fontSize="15" fontWeight="700">
            ¼
          </text>
        </>
      ) : history ? (
        <>
          <ellipse cx="150" cy="157" rx="81" ry="9" fill="#DBBCA3" opacity=".4" />
          <path d="M67 116l23-39h120l23 39v28H67z" fill="#EBC5AB" />
          <path d="M76 115h148v25H76z" fill="#F5DEC4" />
          <path d="M92 83h116" stroke="#AA7C63" strokeWidth="5" />
          <path d="M110 125h80" stroke="#DDB395" strokeWidth="10" />
          <path d="M155 84V20" stroke="#977A74" strokeWidth="3" />
          <path d="M158 21h55v35h-55z" fill="#FFF6ED" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M158 ${23 + i * 8}h55`} stroke="#EC8F84" strokeWidth="4" />
          ))}
          <path d="M158 21h25v21h-25z" fill="#8B84BD" />
          <circle cx="171" cy="31" r="7" fill="#F7D377" />
          <circle cx="174" cy="29" r="6" fill="#8B84BD" />
          <path d="M39 111v35m216-35v35" stroke="#A5BDA0" strokeWidth="7" />
          <circle cx="39" cy="108" r="15" fill="#B9CDA6" />
          <circle cx="255" cy="108" r="15" fill="#B9CDA6" />
        </>
      ) : plant ? (
        <>
          <path d="M150 141V74" stroke="#65A888" strokeWidth="7" />
          <path
            d="M151 101c-54 0-60-33-60-33 47-7 61 23 60 33M151 84c44 0 57-34 57-34-48-2-58 27-57 34"
            fill="#85C79D"
          />
          <path d="M127 139h47l-7 31h-31z" fill="#DEA780" />
          <circle cx="80" cy="39" r="18" fill="#F4D07D" />
        </>
      ) : (
        <>
          <ellipse
            cx="150"
            cy="90"
            rx="105"
            ry="52"
            transform="rotate(-15 150 90)"
            stroke="#C0D2E8"
            strokeDasharray="3 6"
          />
          <circle cx="149" cy="88" r="44" fill={'url(#' + uid + ')'} />
          <ellipse
            cx="148"
            cy="98"
            rx="69"
            ry="15"
            transform="rotate(-20 148 98)"
            stroke="#E6BAA5"
            strokeWidth="9"
          />
          <circle cx="52" cy="84" r="12" fill="#F1C775" />
          <circle cx="245" cy="98" r="16" fill="#A5CCDB" />
          <circle cx="187" cy="25" r="7" fill="#E9AF9C" />
        </>
      )}
      {[
        [54, 38],
        [244, 32],
        [245, 142],
      ].map(([x, y], i) => (
        <path
          key={i}
          d={`M${x} ${y - 4}v8M${x - 4} ${y}h8`}
          stroke={heart ? '#76BAA7' : pizza ? '#D9A76B' : '#B9A5D0'}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
