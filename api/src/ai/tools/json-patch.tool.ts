import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { applyPatch, Operation } from 'fast-json-patch';

@Injectable()
export class JsonPatchTool {
  async applyPatchToFile(params: { filePath: string; patch: Operation[]; validate?: boolean }): Promise<{ success: true; filePath: string } | { success: false; error: string }>
  {
    const { filePath, patch, validate } = params;
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      let base: any = {};
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        base = JSON.parse(raw);
      } catch {
        base = {};
      }

      const { newDocument } = applyPatch(base, patch, validate === true);
      const text = JSON.stringify(newDocument, null, 2) + '\n';
      await fs.writeFile(filePath, text, 'utf8');
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
}


