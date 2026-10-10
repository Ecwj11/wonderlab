import { Mascot } from './art';

/** A trusted illustration for the children's portal; no generated markup. */
export function PlaygroundArt() {
  return (
    <svg className="playground-art" viewBox="0 0 500 370" fill="none" aria-hidden="true">
      <path
        d="M57 285C43 161 114 45 252 47c144 2 205 101 189 243"
        stroke="#B1E7FF"
        strokeWidth="28"
        strokeLinecap="round"
      />
      <path
        d="M73 280C66 165 131 66 252 68c120 2 184 90 173 214"
        stroke="#FFF"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <circle cx="400" cy="66" r="27" fill="#FFD447" />
      <path
        d="M400 26v-10m0 100v-10m40-40h10m-100 0h10m69-29 7-7m-72 72 7-7m58 0 7 7m-72-72 7 7"
        stroke="#F4B528"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M52 101h92a17 17 0 0 0-4-33 25 25 0 0 0-46-9 20 20 0 0 0-34 15 14 14 0 0 0-8 27ZM325 161h107a17 17 0 0 0 0-34 27 27 0 0 0-48-17 24 24 0 0 0-39 26 14 14 0 0 0-20 25Z"
        fill="white"
      />
      <ellipse cx="253" cy="309" rx="167" ry="26" fill="#90D8F3" opacity=".5" />
      <path d="M84 278q0-25 30-25h281q28 0 28 25v20q-170 63-339-3Z" fill="#2AAF80" />
      <ellipse cx="253" cy="272" rx="168" ry="35" fill="#81DEAB" />
      <path
        d="M208 267q60-52 121-16t49 31"
        stroke="#FFF2BF"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path d="M254 172v82" stroke="#27654E" strokeWidth="6" strokeLinecap="round" />
      <path d="M190 210q58-20 64-12 34-13 69 5v54q-34-12-69-1-32-13-64 0Z" fill="#6A53DB" />
      <path
        d="M190 201q36-12 64 1 32-13 69-1v47q-34-12-69-1-29-13-64 0Z"
        fill="#FFF"
        stroke="#DAD9F6"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M254 203v43m-49-23 34-3m-34 14 34-3m31-12 38 3m-38 8 38 3"
        stroke="#BBB2EC"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <svg x="170" y="62" width="165" height="165">
        <Mascot />
      </svg>
      <g transform="translate(36 163) rotate(-12)">
        <rect y="6" width="91" height="77" rx="20" fill="#E97B35" />
        <rect width="91" height="77" rx="20" fill="#FFAC62" stroke="white" strokeWidth="4" />
        <path
          d="M26 29h20m-10-10v20m18-14 13 13m0-13-13 13m-24 19h38"
          stroke="#954218"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
      <g transform="translate(374 194) rotate(12)">
        <rect y="6" width="89" height="77" rx="20" fill="#008CAF" />
        <rect width="89" height="77" rx="20" fill="#40C9EB" stroke="white" strokeWidth="4" />
        <path
          d="M37 17v23L25 58q-3 5 5 5h31q7 0 3-6L52 40V17"
          stroke="#146887"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M38 49h14l8 11H31Z" fill="#FFF2A1" />
        <path d="M34 17h22" stroke="#146887" strokeWidth="4" strokeLinecap="round" />
        <circle cx="46" cy="34" r="3" fill="white" />
      </g>
      <g transform="translate(304 20) rotate(9)">
        <path d="M0 5h35v46L17 40 0 51Z" fill="#FF697C" stroke="white" strokeWidth="3" />
        <path d="m17 13 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="#FFE578" />
      </g>
      <path
        d="M123 309v-37m0 11q-23-4-23-18 23-3 23 18m0 13q25-2 25-17-22-4-25 17"
        stroke="#237B59"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m169 34 4 10 11 1-8 7 3 11-10-6-9 6 2-11-8-7 11-1Zm178 279 4 10 11 1-8 7 3 11-10-6-9 6 2-11-8-7 11-1Z"
        fill="#FFC53F"
      />
      <circle cx="59" cy="312" r="5" fill="#FF7988" />
      <circle cx="446" cy="100" r="5" fill="#8B70F2" />
      <path
        d="m141 137 4 4 9-9m203-55 4 4 9-9"
        stroke="#31A877"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
