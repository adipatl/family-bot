import type { messagingApi } from "@line/bot-sdk";

// --- Keyword patterns for category detection ---

const CATEGORY_PATTERNS: { category: string; pattern: RegExp }[] = [
  {
    category: "calendar",
    pattern:
      /ปฏิทิน|นัด|ลงตาราง|กี่โมง|วันไหน|ไปหาหมอ|นัดหมาย|ตาราง|วันนี้มี|พรุ่งนี้มี|มีนัด|ลงวัน|schedule|calendar/i,
  },
  {
    category: "reminder",
    pattern: /เตือน|remind|แจ้งเตือน|alarm|ตั้งเตือน|เช็ค reminder/i,
  },
  {
    category: "homework",
    pattern:
      /การบ้าน|อธิบาย|สอน|คำนวณ|เท่ากับ|homework|โจทย์|สมการ|แก้สมการ|คูณ|หาร|บวก|ลบ|เลขยกกำลัง/i,
  },
];

// --- Static ack messages by category (Thai + English) ---

const ACK_MESSAGES: Record<string, { th: string[]; en: string[] }> = {
  calendar: {
    th: [
      "คุกกี้กำลังเช็คปฏิทินให้เลยนะคะ",
      "เดี๋ยวคุกกี้ดูตารางให้นะคะ",
      "รอสักครู่นะคะ คุกกี้กำลังเปิดปฏิทินอยู่",
    ],
    en: [
      "Kookie's checking the calendar~",
      "Let me look at the schedule!",
      "Hang on, checking the calendar~",
    ],
  },
  reminder: {
    th: [
      "โอเค คุกกี้ตั้งเตือนให้เลยนะคะ",
      "ได้เลยค่ะ คุกกี้จัดการให้",
      "รับทราบค่ะ คุกกี้กำลังตั้งเตือนอยู่",
    ],
    en: [
      "Got it! Setting a reminder~",
      "On it! Kookie will remind you~",
      "Sure thing! Setting that up~",
    ],
  },
  homework: {
    th: [
      "คุกกี้กำลังคิดให้นะคะ",
      "เดี๋ยวคุกกี้อธิบายให้นะคะ",
      "รอสักครู่นะ คุกกี้กำลังหาคำตอบอยู่",
    ],
    en: [
      "Kookie's thinking on this~",
      "Let me figure this out!",
      "Hmm, let Kookie think~",
    ],
  },
  fallback: {
    th: [
      "รอสักครู่นะคะ คุกกี้กำลังจัดการให้",
      "เดี๋ยวคุกกี้ดูให้นะคะ",
      "คุกกี้รับทราบแล้วค่ะ รอสักครู่นะ",
    ],
    en: [
      "Hang on~ Kookie's on it!",
      "Got it! Give Kookie a sec~",
      "One moment~ Kookie's working on it!",
    ],
  },
};

// --- Cute LINE stickers that match Kookie's personality ---
// Each entry: [packageId, stickerId]
const CUTE_STICKERS: [string, string][] = [
  ["11537", "52002734"], // happy
  ["11537", "52002735"], // cheerful
  ["11537", "52002736"], // excited
  ["11537", "52002738"], // wink
  ["11537", "52002739"], // love
  ["11537", "52002744"], // thumbs up
  ["11537", "52002750"], // working
  ["11537", "52002753"], // thinking
  ["11537", "52002757"], // ok!
  ["11537", "52002764"], // sparkle
  ["11538", "51626494"], // cute wave
  ["11538", "51626497"], // happy
  ["11538", "51626501"], // smile
  ["11538", "51626504"], // cheerful
  ["11538", "51626518"], // peace
  ["11539", "52114110"], // hi
  ["11539", "52114113"], // cute
  ["11539", "52114115"], // cheerful
  ["11539", "52114129"], // ok
];

// --- Helpers ---

const ENGLISH_PATTERN = /^[a-zA-Z0-9\s.,!?'"()\-:;@#$%&*+=/\\[\]{}|<>~`^]+$/;

function isEnglish(message: string): boolean {
  return ENGLISH_PATTERN.test(message.trim());
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function detectCategory(message: string): string {
  for (const { category, pattern } of CATEGORY_PATTERNS) {
    if (pattern.test(message)) {
      return category;
    }
  }
  return "fallback";
}

function getRandomSticker(): messagingApi.StickerMessage {
  const [packageId, stickerId] = pickRandom(CUTE_STICKERS);
  return { type: "sticker", packageId, stickerId };
}

// --- Public API ---

export function generateAckMessages(
  userMessage: string,
): messagingApi.Message[] {
  const category = detectCategory(userMessage);
  const lang = isEnglish(userMessage) ? "en" : "th";
  const messages = ACK_MESSAGES[category][lang];
  const text = pickRandom(messages);

  return [
    { type: "text", text },
    getRandomSticker(),
  ];
}
