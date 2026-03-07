import { getGraph } from "./src/graph/index.js";

const TEST_MESSAGES = [
  { text: "สวัสดีจ้า", expected: "chat_agent" },
  { text: "วันเสาร์ 10 โมง ไปหาหมอ", expected: "calendar_agent" },
  { text: "วันนี้มีนัดอะไรบ้าง", expected: "calendar_agent" },
  { text: "จดไว้ด้วย ซื้อนมกลับบ้าน", expected: "notes_agent" },
  { text: "ดูโน้ตทั้งหมด", expected: "notes_agent" },
  { text: "เตือนด้วย พรุ่งนี้เช้าซื้อนม", expected: "reminder_agent" },
  { text: "เช็ค reminder", expected: "reminder_agent" },
  { text: "ช่วยอธิบาย photosynthesis", expected: "homework_agent" },
  { text: "5 + 3 เท่ากับเท่าไร", expected: "homework_agent" },
  { text: "วันนี้อากาศดีจัง", expected: "chat_agent" },
];

async function test() {
  const graph = getGraph();

  for (const { text, expected } of TEST_MESSAGES) {
    try {
      const result = await graph.invoke({
        userMessage: text,
        userName: "ทดสอบ",
        userId: "test-user",
        groupId: "test-group",
      });

      const match = result.routedTo === expected ? "✅" : "❌";
      console.log(
        `${match} "${text}" → ${result.routedTo} (expected: ${expected})`,
      );
      console.log(`   Reply: ${result.replyText?.substring(0, 80)}...\n`);
    } catch (err) {
      console.error(`❌ "${text}" → ERROR: ${err}\n`);
    }
  }
}

test();
