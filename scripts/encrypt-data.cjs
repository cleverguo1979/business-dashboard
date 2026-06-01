/**
 * XLS → CSV → AES-256-CBC 加密脚本
 * 用法: node scripts/encrypt-data.cjs
 *
 * 将桌面 claude 文件夹中的 1-3月 XLS 文件转换为加密 CSV，
 * 输出到 public/ 目录，供 DashboardPage 一键加载。
 */
const XLSX = require('xlsx');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PASSPHRASE = '远海通';
const DESKTOP_CLAUDE = path.join(require('os').homedir(), 'Desktop', 'claude');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// 输入文件映射：XLS 文件名 → 输出 CSV 文件名
const FILES = [
  { xls: '工作效率统计报表(1月）.xls', out: '数据2026-01.csv' },
  { xls: '工作效率统计报表(2月）.xls', out: '数据2026-02.csv' },
  { xls: '工作效率统计报表(3月）.xls', out: '数据2026-03.csv' },
];

/**
 * 从密码派生 AES-256-CBC 密钥（与前端 decrypt.ts 的 deriveKeyFromPassphrase 一致）
 */
function deriveKey(passphrase) {
  return crypto.createHash('sha256').update(passphrase).digest(); // 32 bytes raw key
}

/**
 * 加密 CSV 文本，返回 Buffer（格式：IV[16] + ciphertext）
 * 与前端 decryptCSV 的解密逻辑匹配
 */
function encrypt(csvText, passphrase) {
  const key = deriveKey(passphrase);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(csvText, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

/**
 * 将 XLS 转换为 CSV 文本
 */
function xlsToCsv(xlsPath) {
  const workbook = XLSX.readFile(xlsPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(sheet);
}

// ---- Main ----
console.log('=== 数据加密脚本 ===\n');

for (const { xls, out } of FILES) {
  const xlsPath = path.join(DESKTOP_CLAUDE, xls);
  const encPath = path.join(PUBLIC_DIR, out + '.enc');

  if (!fs.existsSync(xlsPath)) {
    console.log(`⚠ 跳过: ${xls} (文件不存在)`);
    continue;
  }

  console.log(`📄 转换: ${xls}`);
  const csv = xlsToCsv(xlsPath);
  console.log(`   CSV 大小: ${(csv.length / 1024 / 1024).toFixed(1)} MB`);

  console.log(`🔐 加密: ${out}.enc`);
  const encBuf = encrypt(csv, PASSPHRASE);
  fs.writeFileSync(encPath, encBuf);
  console.log(`   ✅ 输出: ${encPath} (${(encBuf.length / 1024 / 1024).toFixed(1)} MB)\n`);
}

console.log('完成！');
