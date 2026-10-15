/* Minecraft-style angle diagrams for Angle Quest. Labels only — the builds stay fixed. */
(() => {
  "use strict";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function sky(w, h, inner) {
    return `<svg class="diagram build" viewBox="0 0 ${w} ${h}" role="img">
      <rect width="${w}" height="${h}" fill="#8ec8f6"/>
      <rect y="${h - 28}" width="${w}" height="14" fill="#5d9c3a"/>
      <rect y="${h - 14}" width="${w}" height="14" fill="#8b5a2b"/>
      <rect y="${h - 28}" width="${w}" height="3" fill="#3d6b26" opacity="0.35"/>
      ${inner}
    </svg>`;
  }

  function chip(x, y, text, fill) {
    const label = esc(text);
    const w = Math.max(72, label.length * 9.2 + 18);
    const h = 26;
    return `
      <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="#1a1a1a" stroke-width="2"/>
      <text x="${x}" y="${y + 5}" text-anchor="middle" font-family="Nunito, sans-serif" font-size="14" font-weight="800" fill="#fff">${label}</text>`;
  }

  /** Two paths cross like swords. Opposite labels are the twins. */
  function crossed({ top, right, bottom, left }) {
    return sky(
      420,
      250,
      `
      <line x1="55" y1="36" x2="365" y2="196" stroke="#3a3a3a" stroke-width="7" stroke-linecap="square"/>
      <line x1="55" y1="196" x2="365" y2="36" stroke="#5a3a1a" stroke-width="7" stroke-linecap="square"/>
      <circle cx="210" cy="116" r="7" fill="#ffeb3b" stroke="#1a1a1a" stroke-width="2"/>
      <path d="M210 116 L248 86 A46 46 0 0 1 248 146 Z" fill="#42a5f5" opacity="0.85"/>
      <path d="M210 116 L172 146 A46 46 0 0 1 172 86 Z" fill="#42a5f5" opacity="0.85"/>
      <path d="M210 116 L172 86 A46 46 0 0 1 248 86 Z" fill="#ffb300" opacity="0.9"/>
      <path d="M210 116 L248 146 A46 46 0 0 1 172 146 Z" fill="#ffb300" opacity="0.9"/>
      ${chip(210, 48, top, "#e65100")}
      ${chip(318, 116, right, "#1565c0")}
      ${chip(210, 196, bottom, "#e65100")}
      ${chip(96, 116, left, "#1565c0")}
      `,
    );
  }

  /** Two angles side by side on flat ground. */
  function linear({ left, right }) {
    return sky(
      420,
      230,
      `
      <line x1="24" y1="168" x2="396" y2="168" stroke="#3a3a3a" stroke-width="7" stroke-linecap="square"/>
      <line x1="200" y1="168" x2="318" y2="48" stroke="#5a3a1a" stroke-width="7" stroke-linecap="square"/>
      <path d="M200 168 L268 168 A68 68 0 0 0 246 112 Z" fill="#42a5f5" opacity="0.85"/>
      <path d="M200 168 L246 112 A90 90 0 0 0 110 168 Z" fill="#ffb300" opacity="0.9"/>
      <circle cx="200" cy="168" r="6" fill="#ffeb3b" stroke="#1a1a1a" stroke-width="2"/>
      ${chip(108, 118, left, "#e65100")}
      ${chip(292, 140, right, "#1565c0")}
      `,
    );
  }

  /** Three angles on one straight dirt path. Middle can be y. */
  function triple({ left, mid, right }) {
    return sky(
      440,
      240,
      `
      <line x1="20" y1="176" x2="420" y2="176" stroke="#3a3a3a" stroke-width="7" stroke-linecap="square"/>
      <line x1="210" y1="176" x2="132" y2="52" stroke="#5a3a1a" stroke-width="7" stroke-linecap="square"/>
      <line x1="210" y1="176" x2="300" y2="46" stroke="#5a3a1a" stroke-width="7" stroke-linecap="square"/>
      <path d="M210 176 L158 108 A70 70 0 0 0 78 176 Z" fill="#ffb300" opacity="0.9"/>
      <path d="M210 176 L262 104 A62 62 0 0 0 158 108 Z" fill="#7e57c2" opacity="0.85"/>
      <path d="M210 176 L340 176 A70 70 0 0 0 262 104 Z" fill="#42a5f5" opacity="0.85"/>
      <path d="M168 128 A28 28 0 0 1 184 118" fill="none" stroke="#1a1a1a" stroke-width="3"/>
      <path d="M160 136 A36 36 0 0 1 188 114" fill="none" stroke="#1a1a1a" stroke-width="3"/>
      <path d="M248 124 A28 28 0 0 1 236 112" fill="none" stroke="#1a1a1a" stroke-width="3"/>
      <path d="M256 132 A36 36 0 0 1 230 108" fill="none" stroke="#1a1a1a" stroke-width="3"/>
      <circle cx="210" cy="176" r="6" fill="#ffeb3b" stroke="#1a1a1a" stroke-width="2"/>
      ${chip(78, 124, left, "#e65100")}
      ${chip(210, 78, mid, "#6a1b9a")}
      ${chip(348, 124, right, "#1565c0")}
      `,
    );
  }

  /** A grass-block corner split into two pieces. */
  function corner({ upper, lower }) {
    return sky(
      420,
      240,
      `
      <rect x="48" y="36" width="86" height="86" fill="#8b5a2b" stroke="#3a2412" stroke-width="3"/>
      <rect x="48" y="36" width="86" height="22" fill="#5d9c3a" stroke="#3d6b26" stroke-width="3"/>
      <line x1="70" y1="188" x2="70" y2="28" stroke="#3a3a3a" stroke-width="7" stroke-linecap="square"/>
      <line x1="70" y1="188" x2="390" y2="188" stroke="#3a3a3a" stroke-width="7" stroke-linecap="square"/>
      <line x1="70" y1="188" x2="250" y2="52" stroke="#5a3a1a" stroke-width="7" stroke-linecap="square"/>
      <rect x="70" y="164" width="24" height="24" fill="none" stroke="#d32f2f" stroke-width="3"/>
      <path d="M70 188 L70 112 A76 76 0 0 1 128 142 Z" fill="#42a5f5" opacity="0.85"/>
      <path d="M70 188 L128 142 A76 76 0 0 1 146 188 Z" fill="#ffb300" opacity="0.9"/>
      <circle cx="70" cy="188" r="6" fill="#ffeb3b" stroke="#1a1a1a" stroke-width="2"/>
      ${chip(168, 92, upper, "#1565c0")}
      ${chip(196, 156, lower, "#e65100")}
      `,
    );
  }

  /** Little angles craft into one big angle. */
  function addition({ whole, left, right }) {
    return sky(
      440,
      250,
      `
      <line x1="70" y1="190" x2="70" y2="36" stroke="#3a3a3a" stroke-width="7" stroke-linecap="square"/>
      <line x1="70" y1="190" x2="400" y2="150" stroke="#3a3a3a" stroke-width="7" stroke-linecap="square"/>
      <line x1="70" y1="190" x2="250" y2="48" stroke="#5a3a1a" stroke-width="7" stroke-linecap="square"/>
      <path d="M70 190 L70 78 A112 112 0 0 1 168 132 Z" fill="#42a5f5" opacity="0.8"/>
      <path d="M70 190 L168 132 A112 112 0 0 1 176 168 Z" fill="#ffb300" opacity="0.9"/>
      <path d="M150 78 A130 130 0 0 1 196 150" fill="none" stroke="#d32f2f" stroke-width="4" stroke-dasharray="7 5"/>
      <circle cx="70" cy="190" r="6" fill="#ffeb3b" stroke="#1a1a1a" stroke-width="2"/>
      ${chip(250, 36, whole, "#c62828")}
      ${chip(150, 100, left, "#1565c0")}
      ${chip(230, 160, right, "#e65100")}
      `,
    );
  }

  /** Two separate angles with the same tick marks: a congruence pair. */
  function twins({ leftMeasure, rightMeasure, statement }) {
    return sky(
      440,
      250,
      `
      <line x1="40" y1="176" x2="150" y2="48" stroke="#3a3a3a" stroke-width="6" stroke-linecap="square"/>
      <line x1="40" y1="176" x2="168" y2="150" stroke="#3a3a3a" stroke-width="6" stroke-linecap="square"/>
      <path d="M78 150 A42 42 0 0 1 86 124" fill="none" stroke="#6a1b9a" stroke-width="3"/>
      <path d="M86 156 A52 52 0 0 1 96 124" fill="none" stroke="#6a1b9a" stroke-width="3"/>
      <text x="28" y="64" font-family="Nunito, sans-serif" font-size="16" font-weight="800" fill="#1a1a1a">B</text>
      <text x="24" y="196" font-family="Nunito, sans-serif" font-size="16" font-weight="800" fill="#1a1a1a">A</text>
      <text x="174" y="148" font-family="Nunito, sans-serif" font-size="16" font-weight="800" fill="#1a1a1a">C</text>
      <line x1="250" y1="176" x2="360" y2="48" stroke="#3a3a3a" stroke-width="6" stroke-linecap="square"/>
      <line x1="250" y1="176" x2="390" y2="148" stroke="#3a3a3a" stroke-width="6" stroke-linecap="square"/>
      <path d="M288 150 A42 42 0 0 1 296 124" fill="none" stroke="#6a1b9a" stroke-width="3"/>
      <path d="M296 156 A52 52 0 0 1 306 124" fill="none" stroke="#6a1b9a" stroke-width="3"/>
      <text x="238" y="64" font-family="Nunito, sans-serif" font-size="16" font-weight="800" fill="#1a1a1a">E</text>
      <text x="232" y="196" font-family="Nunito, sans-serif" font-size="16" font-weight="800" fill="#1a1a1a">D</text>
      <text x="396" y="146" font-family="Nunito, sans-serif" font-size="16" font-weight="800" fill="#1a1a1a">F</text>
      ${chip(100, 112, leftMeasure, "#6a1b9a")}
      ${chip(318, 112, rightMeasure, "#6a1b9a")}
      ${chip(220, 28, statement, "#2e7d32")}
      `,
    );
  }

  window.AQ = { crossed, linear, triple, corner, addition, twins };
})();
