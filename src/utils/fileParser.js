import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { CHUNK_SIZE, MAX_FILE_SIZE } from '../config/constants';

export async function parseFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），限制200MB，请拆分后上传`);
  }

  const ext = file.name.split('.').pop().toLowerCase();

  let rawText = '';
  if (ext === 'txt') {
    rawText = await readTextFile(file);
  } else if (ext === 'docx') {
    rawText = await parseDocx(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    rawText = await parseExcel(file);
  } else {
    throw new Error(`不支持 ${ext} 格式，请上传 .docx / .xlsx / .txt 文件`);
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new Error('文件中未提取到任何文本内容，请检查文件是否包含文字');
  }

  return rawText;
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'UTF-8');
  });
}

async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const allLines = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          if (workbook.SheetNames.length > 1) {
            allLines.push(`===== Sheet: ${sheetName} =====`);
          }
          
          for (const row of json) {
            const filtered = row.filter(c => c !== undefined && c !== null && String(c).trim() !== '');
            if (filtered.length > 0) {
              allLines.push(filtered.join('\t'));
            }
          }
        }

        resolve(allLines.join('\n'));
      } catch (e) {
        reject(new Error('Excel解析失败: ' + e.message));
      }
    };
    reader.onerror = () => reject(new Error('Excel文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

export function splitIntoChunks(text) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks = [];
  let current = [];

  for (const para of paragraphs) {
    const paraLen = para.length;
    const currentLen = current.join('\n').length;

    if (currentLen + paraLen > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.join('\n\n'));
      current = [para];
    } else {
      current.push(para);
    }
  }

  if (current.length > 0) {
    chunks.push(current.join('\n\n'));
  }

  return chunks.length > 0 ? chunks : [text];
}

