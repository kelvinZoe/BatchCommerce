const fs = require('fs');
const file = '/Users/qliq/Desktop/shakis/comerce/app/src/app/pages/products/products.component.ts';
let code = fs.readFileSync(file, 'utf8');

// add stat cards import
if (!code.includes('StatCardsComponent')) {
  code = code.replace(/import \{ TableComponent.*\} from '\.\.\/\.\.\/components\/table\/table\.component';/g, "import { StatCardsComponent } from '../../components/stat-cards/stat-cards.component';\n$&");
  code = code.replace(/imports: \[(.*?), TableComponent/g, "imports: [$1, StatCardsComponent, TableComponent");
}

// add DateFilterComponent import
if (!code.includes('DateFilterComponent')) {
  code = code.replace(/import \{ StatCardsComponent.*\} from/g, "import { DateFilterComponent } from '../../components/date-filter/date-filter.component';\n$&");
  code = code.replace(/imports: \[(.*?), StatCardsComponent/g, "imports: [$1, DateFilterComponent, StatCardsComponent");
}

if (!code.includes('catalogStatCards')) {
  code = code.replace(/catalogFilters: TableFilterConfig\[\] = \[/g, 
`catalogStatCards: any = {
    cards: [
      { label: 'Total Products', value: 0, icon: 'inventory_2', color: 'blue' }
    ]
  };

  catalogFilters: TableFilterConfig[] = [`);
}

if (!code.includes('batchProductStatCards')) {if (!code.includes('batchProductStatCards')) {if (!code.includes('batchProductStatCards')) {if (!code.includes('batchProductStatCards')) {if (!code.includes('batchProductStatCards')) {if (!code.includes(' ]
  };
  
  $&`);
}

// Add stat cards to catalog table
code = code.replace(/<\!-- Products table -->/g, `<app-stat-cards [config]="catalogStatCards"></app-stat-cards>\n          <!-- Products tacode = cod
code = code.replace(/<\!-- Product table -->/g, `<app-stat-cards [config]="batchProductStatCards"></app-stat-cards>\n          <!-- Product table -->`)code = code.replace(/<\!-- Product table -->/g, `<app-stat-cards [config]="batchProductStatCards"></app-stat-cards>\olumns".code = code.replace(/<\!-- Product ta    <app-date-filter table-toolbar-start (dateChange)="onBatchProductDateChcode = code.replace(/<\!-ficode =       code = code.replace(/<\!-- Product table -->/g, `<app-stat-cards [config]="batlumns".*cod><\code = code.replace(/<\!-- Product table ---filter table-toolbar-start (dateChange)="onCatalogDateChange($event)"></app-date-filter>\n          <\/app-table>`);

// Add date change handlers
if (!code.includes('onBatchProductDateChange')) {
  code = code.replace(/onBatchProductSearchChange/g, `onBatchProductDateChange(e: any) {}\n  onBatchProductSearchCh  code = code.replace(/onBatchProductSearchChange/g, `onBatchProductDateChange(e: any) {}\n  onBatchProductSearchCh  code = code.replace(/onBatchProearchChange`);
}

// Ensure stat cards updates in component
code = code.replace(/this\.catalogTotal = total;/g, `this.catalogTotal = total;\n      this.catalogStatCards.cards[0].value = total;`);
code = code.replace(/this\.batchProductsTotal = total;/g, `this.batchProductsTotal = total;\n      this.batchProductStatCards.cards[0].value = total;`);

fs.writeFileSync(file, code);
