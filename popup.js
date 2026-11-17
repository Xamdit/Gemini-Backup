const backupButton = document.querySelector("#backup");
const status = document.querySelector("#status");

backupButton.addEventListener("click", async () => {
  backupButton.disabled = true;
  status.textContent = "กำลังหาเนื้อหาบทสนทนาและสร้างไฟล์ HTML...";

  try {
    const result = await chrome.runtime.sendMessage({ type: "BACKUP_ACTIVE_TAB" });
    if (!result?.ok) {
      throw new Error(result?.error || "ไม่สามารถสำรองหน้าเว็บได้");
    }
    status.textContent = "เริ่มดาวน์โหลดไฟล์ HTML แล้ว";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    backupButton.disabled = false;
  }
});
