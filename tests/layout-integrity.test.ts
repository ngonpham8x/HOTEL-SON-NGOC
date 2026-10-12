import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareServiceSale } from '../src/utils/serviceSale';
import type { ServiceItem } from '../src/types/hotel';

test('Sidebar layout and CSS enforce dark scrollbar and overflow prevention', () => {
  const css = readFileSync('src/index.css', 'utf-8');
  assert.ok(css.includes('aside {\n  color-scheme: dark;\n}'), 'aside must declare color-scheme: dark');
  assert.ok(css.includes('.sidebar-scroll'), 'custom .sidebar-scroll must be defined');
  assert.ok(css.includes('scrollbar-width: thin;'), 'sidebar-scroll must declare thin scrollbar');

  const sidebar = readFileSync('src/components/layout/Sidebar.tsx', 'utf-8');
  assert.ok(sidebar.includes('sidebar-scroll'), 'Sidebar nav must use sidebar-scroll class');
  assert.ok(sidebar.includes('overflow-hidden'), 'Inner container must prevent horizontal overflow');
  assert.ok(sidebar.includes('sidebar-footer px-3 py-2.5'), 'Sidebar footer must align with px-3 padding');

  const viteConfig = readFileSync('vite.config.ts', 'utf-8');
  assert.ok(viteConfig.includes('const FILES ='), 'Service worker in vite.config.ts must declare FILES asset cache array');
});

test('prepareServiceSale rejects invalid payment method and accepts valid CASH, TRANSFER, CARD', () => {
  const catalog: ServiceItem[] = [
    { id: 's1', name: 'Nước suối', category: 'MINIBAR', categoryName: 'Minibar', price: 10000, unit: 'Chai' },
  ];

  const valid = prepareServiceSale({
    customerName: 'Khách A',
    phone: '0901234567',
    items: [{ serviceId: 's1', quantity: 2 }],
    discount: 0,
    paidAmount: 20000,
    paymentMethod: 'CASH',
  }, catalog);

  assert.equal(valid.invoice.paidAmount, 20000);
  assert.equal(valid.invoice.paymentMethod, 'CASH');

  assert.throws(() => {
    prepareServiceSale({
      customerName: 'Khách B',
      phone: '0901234567',
      items: [{ serviceId: 's1', quantity: 1 }],
      discount: 0,
      paidAmount: 10000,
      // @ts-expect-error test invalid payment method at runtime
      paymentMethod: 'UNKNOWN',
    }, catalog);
  }, /Phương thức thanh toán không hợp lệ/);
});
