import { Component, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExcelService, ImportResult } from '../../services/excel.service';
import * as XLSX from 'xlsx';

type DataType = 'products' | 'clients' | 'buying_list' | 'items_sorting' | 'deliveries' | 'skip';

interface SheetMapping {
  name: string;
  dataType: DataType;
  rowCount: number;
  headers: string[];
}

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="import-page">
      <div class="page-header">
        <h1>Import Data</h1>
        <p class="subtitle">Import your Excel data into the application</p>
      </div>

      <div class="import-container">
        <div class="card upload-card">
          <div class="upload-area"
               (drop)="onDrop($event)"
               (dragover)="onDragOver($event)"
               (dragleave)="onDragLeave($event)"
               [class.dragover]="isDragOver">
            <span class="material-icons">cloud_upload</span>
            <h3>Drop Excel file here</h3>
            <p>or click to browse</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              (change)="onFileSelect($event)"
              #fileInput
            />
            <button class="btn btn-primary" (click)="fileInput.click()">
              Select File
            </button>
            <button class="btn btn-secondary btn-sample" (click)="downloadSample(); $event.stopPropagation()">
              <span class="material-icons">download</span>
              Download Sample Template
            </button>
          </div>

          <div class="file-info" *ngIf="selectedFile">
            <span class="material-icons">description</span>
            <div>
              <strong>{{ selectedFile.name }}</strong>
              <small>{{ (selectedFile.size / 1024).toFixed(2) }} KB</small>
            </div>
            <button class="btn btn-sm btn-danger" (click)="clearFile()">
              <span class="material-icons">close</span>
            </button>
          </div>
        </div>

        <!-- Sheet mapping -->
        <div class="card" *ngIf="sheetMappings.length > 0">
          <div class="card-header">
            <h2>Map Sheets to Data Type</h2>
            <small class="auto-hint">Auto-detected based on sheet names &amp; headers</small>
          </div>
          <div class="sheets-list">
            <div class="sheet-item" *ngFor="let sheet of sheetMappings; let i = index">
              <div class="sheet-left">
                <div class="sheet-info">
                  <span class="material-icons">table_chart</span>
                  <div>
                    <span class="sheet-name">{{ sheet.name }}</span>
                    <small class="sheet-meta">{{ sheet.rowCount }} rows &middot; {{ sheet.headers.slice(0, 4).join(', ') }}{{ sheet.headers.length > 4 ? '...' : '' }}</small>
                  </div>
                </div>
              </div>
              <div class="sheet-right">
                <select [(ngModel)]="sheet.dataType" class="type-select">
                  <option value="skip">⏭ Skip</option>
                  <option value="products">📦 Products</option>
                  <option value="clients">👥 Clients</option>
                  <option value="buying_list">🛒 Buying List</option>
                  <option value="items_sorting">📋 Items Sorting</option>
                  <option value="deliveries">🚚 Deliveries</option>
                </select>
                <button
                  class="btn btn-sm btn-primary"
                  (click)="importSingle(i)"
                  [disabled]="importing || sheet.dataType === 'skip'">
                  {{ importingSheet === i ? 'Importing...' : 'Import' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Batch name + Import All -->
        <div class="card" *ngIf="sheetMappings.length > 0">
          <div class="card-header">
            <h2>Import Options</h2>
          </div>
          <div class="quick-actions">
            <div class="form-group">
              <label>Batch Name (for Buying List)</label>
              <input type="text" [(ngModel)]="batchName" placeholder="e.g., Sept. 25th Batch" />
            </div>
            <button
              class="btn btn-success btn-lg"
              (click)="importAll()"
              [disabled]="importing || mappedCount === 0">
              <span class="material-icons">cloud_download</span>
              {{ importing ? 'Importing... ' + importProgress : 'Import All Mapped (' + mappedCount + ' sheets)' }}
            </button>
          </div>
        </div>

        <!-- Results -->
        <div class="card results-card" *ngIf="results.length > 0">
          <div class="card-header">
            <h2>Import Results</h2>
            <button class="btn btn-sm btn-secondary" (click)="clearResults()">Clear</button>
          </div>
          <div class="results-list">
            <div class="result-item" *ngFor="let result of results" [class.success]="result.success" [class.error]="!result.success">
              <span class="material-icons">{{ result.success ? 'check_circle' : 'error' }}</span>
              <div class="result-info">
                <strong>{{ result.sheet }}</strong>
                <span>{{ result.importedRows }} of {{ result.totalRows }} rows imported</span>
              </div>
            </div>
          </div>
          <div class="errors-list" *ngIf="allErrors.length > 0">
            <h4>Errors:</h4>
            <ul>
              <li *ngFor="let error of allErrors">{{ error }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .import-page {
      max-width: 900px;
    }

    .subtitle {
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .auto-hint {
      color: var(--text-secondary);
      font-weight: normal;
    }

    .import-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .upload-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 40px;
      border: 2px dashed var(--border-color);
      border-radius: var(--radius-lg);
      text-align: center;
      transition: all 0.2s ease;
      position: relative;

      .material-icons {
        font-size: 64px;
        color: var(--text-secondary);
        margin-bottom: 16px;
      }

      h3 {
        margin-bottom: 8px;
        color: var(--text-primary);
      }

      p {
        color: var(--text-secondary);
        margin-bottom: 20px;
      }

      input[type="file"] {
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        opacity: 0;
        cursor: pointer;
      }

      &.dragover {
        border-color: var(--primary-color);
        background: rgba(37, 99, 235, 0.05);

        .material-icons {
          color: var(--primary-color);
        }
      }

      &:hover {
        border-color: var(--primary-color);
      }
    }

    .btn-sample {
      margin-top: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      opacity: 0.8;
      z-index: 2;
      position: relative;

      .material-icons {
        font-size: 18px;
      }

      &:hover {
        opacity: 1;
      }
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--background-color);
      border-radius: var(--radius-md);
      margin-top: 20px;

      .material-icons {
        font-size: 32px;
        color: var(--primary-color);
      }

      div {
        flex: 1;
        display: flex;
        flex-direction: column;

        small {
          color: var(--text-secondary);
        }
      }
    }

    .sheets-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sheet-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: var(--background-color);
      border-radius: var(--radius-md);
      gap: 16px;
    }

    .sheet-left {
      flex: 1;
      min-width: 0;
    }

    .sheet-info {
      display: flex;
      align-items: center;
      gap: 12px;

      > .material-icons {
        color: var(--primary-color);
        flex-shrink: 0;
      }

      > div {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
    }

    .sheet-name {
      font-weight: 500;
    }

    .sheet-meta {
      font-size: 12px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sheet-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .type-select {
      padding: 6px 10px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background: var(--surface-color);
      color: var(--text-primary);
      font-size: 13px;
      cursor: pointer;
      min-width: 160px;

      &:focus {
        border-color: var(--primary-color);
        outline: none;
      }
    }

    .quick-actions {
      display: flex;
      flex-direction: column;
      gap: 16px;
      align-items: center;

      .form-group {
        width: 100%;
      }

      .btn-lg {
        width: 100%;
      }
    }

    .results-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: var(--radius-md);

      &.success {
        background: #d1fae5;
        .material-icons { color: #065f46; }
      }

      &.error {
        background: #fee2e2;
        .material-icons { color: #991b1b; }
      }

      .result-info {
        display: flex;
        flex-direction: column;

        span {
          font-size: 12px;
          color: var(--text-secondary);
        }
      }
    }

    .errors-list {
      margin-top: 16px;
      padding: 16px;
      background: #fef2f2;
      border-radius: var(--radius-md);

      h4 {
        color: #991b1b;
        margin-bottom: 8px;
      }

      ul {
        margin: 0;
        padding-left: 20px;
        color: #991b1b;
        font-size: 13px;
      }
    }
  `]
})
export class ImportComponent {
  isDragOver = false;
  selectedFile: File | null = null;
  workbook: XLSX.WorkBook | null = null;
  sheetMappings: SheetMapping[] = [];
  batchName = '';
  importing = false;
  importingSheet: number | null = null;
  importProgress = '';

  results: { sheet: string; success: boolean; totalRows: number; importedRows: number }[] = [];
  allErrors: string[] = [];

  get mappedCount(): number {
    return this.sheetMappings.filter(s => s.dataType !== 'skip').length;
  }

  constructor(
    private excelService: ExcelService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  async processFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    this.selectedFile = file;

    const buffer = await file.arrayBuffer();
    const workbook = await this.excelService.parseExcelFromBuffer(buffer);
    this.workbook = workbook;

    // Build sheet mappings with auto-detection
    this.sheetMappings = workbook.SheetNames.map((name: string) => {
      const sheet = workbook.Sheets[name];
      const rawData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });
      const headers = (rawData[0] || []).map((h: any) => String(h || '').trim());
      const rowCount = Math.max(0, rawData.length - 1);
      const dataType = this.autoDetectType(name, headers);
      return { name, dataType, rowCount, headers };
    });
  }

  /** Auto-detect data type from sheet name + headers */
  private autoDetectType(sheetName: string, headers: string[]): DataType {
    const sn = sheetName.toLowerCase();
    const hdr = headers.map(h => h.toLowerCase()).join(' ');

    // Exact legacy names first
    if (sn === 'prices') return 'products';
    if (sn === 'buying list') return 'buying_list';
    if (sn === 'items sorting') return 'items_sorting';
    if (sn === 'delivery') return 'deliveries';

    // Header-based detection
    if (/product|item.?name|preorder|local.?price|shipping/i.test(hdr)) return 'products';
    if (/client|customer|whatsapp|phone.*address/i.test(hdr)) return 'clients';
    if (/requested|arrived|batch|buying/i.test(hdr)) return 'buying_list';
    if (/delivery|deliver.*date|deliver.*address/i.test(hdr)) return 'deliveries';

    // Name-based fallback
    if (/product|price|item|catalog/i.test(sn)) return 'products';
    if (/client|customer|contact/i.test(sn)) return 'clients';
    if (/buy|order.*list|batch/i.test(sn)) return 'buying_list';
    if (/deliver|ship/i.test(sn)) return 'deliveries';
    if (/sort/i.test(sn)) return 'items_sorting';

    return 'skip';
  }

  clearFile() {
    this.selectedFile = null;
    this.workbook = null;
    this.sheetMappings = [];
  }

  async importSingle(index: number) {
    const mapping = this.sheetMappings[index];
    if (!this.workbook || mapping.dataType === 'skip') return;

    this.importingSheet = index;
    this.importing = true;
    this.importProgress = `(${mapping.name})`;
    this.cdr.detectChanges();

    await this.runImport(mapping);

    this.ngZone.run(() => {
      this.importing = false;
      this.importingSheet = null;
      this.importProgress = '';
      this.cdr.detectChanges();
    });
  }

  async importAll() {
    if (!this.workbook) return;

    this.results = [];
    this.allErrors = [];
    this.importing = true;
    this.cdr.detectChanges();

    for (let i = 0; i < this.sheetMappings.length; i++) {
      const mapping = this.sheetMappings[i];
      if (mapping.dataType === 'skip') continue;
      this.importingSheet = i;
      this.importProgress = `(${mapping.name})`;
      this.cdr.detectChanges();
      await this.runImport(mapping);
    }

    this.ngZone.run(() => {
      this.importing = false;
      this.importingSheet = null;
      this.importProgress = '';
      this.cdr.detectChanges();
    });
  }

  private async runImport(mapping: SheetMapping) {
    let result: ImportResult;
    try {
      const sheet = this.workbook!.Sheets[mapping.name];
      switch (mapping.dataType) {
        case 'products':
          result = await this.excelService.importProductsFromSheet(sheet);
          break;
        case 'clients':
          result = await this.excelService.importClientsFromSheet(sheet);
          break;
        case 'buying_list':
          result = await this.excelService.importBuyingListFromSheet(sheet, this.batchName || 'Imported');
          break;
        case 'items_sorting':
          result = await this.excelService.importItemsSortingFromSheet(sheet);
          break;
        case 'deliveries':
          result = await this.excelService.importDeliveriesFromSheet(sheet);
          break;
        default:
          result = { success: false, totalRows: 0, importedRows: 0, errors: ['Skipped'] };
      }

      this.ngZone.run(() => {
        this.results.push({
          sheet: mapping.name,
          success: result.success,
          totalRows: result.totalRows,
          importedRows: result.importedRows
        });
        if (result.errors.length > 0) {
          this.allErrors.push(...result.errors.map(e => `${mapping.name}: ${e}`));
        }
        this.cdr.detectChanges();
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.results.push({ sheet: mapping.name, success: false, totalRows: 0, importedRows: 0 });
        this.allErrors.push(`${mapping.name}: ${err.message}`);
        this.cdr.detectChanges();
      });
    }
  }

  clearResults() {
    this.results = [];
    this.allErrors = [];
  }

  downloadSample() {
    this.excelService.downloadSampleTemplate();
  }
}
