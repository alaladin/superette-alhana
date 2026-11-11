import { calculateItemCost, calculateItemTotal, formatCurrency, formatQuantityWithUnit } from './formatters';
import { storage } from './storage';
import { Product, SaleItem } from '../types';

export interface TestResult {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  expected: string;
  actual: string;
  durationMs: number;
}

export async function runAutomatedTestSuite(): Promise<TestResult[]> {
  // The suite exercises the real storage methods but restores the exact local
  // snapshot afterward, including products, sales, customers, expenses and outbox.
  const originalState = storage.createStateSnapshot();
  const results: TestResult[] = [];

  const runTest = (
    id: string,
    name: string,
    description: string,
    fn: () => { passed: boolean; expected: string; actual: string }
  ) => {
    const t0 = performance.now();
    try {
      const res = fn();
      const t1 = performance.now();
      results.push({
        id,
        name,
        description,
        passed: res.passed,
        expected: res.expected,
        actual: res.actual,
        durationMs: Math.round(t1 - t0),
      });
    } catch (err: any) {
      const t1 = performance.now();
      results.push({
        id,
        name,
        description,
        passed: false,
        expected: 'نجاح الاختبار دون أخطاء',
        actual: `خطأ استثنائي: ${err.message}`,
        durationMs: Math.round(t1 - t0),
      });
    }
  };

  // 1. حساب الإجمالي بالقطع والأوزان والكسور العشرية
  runTest(
    'calc-piece-total',
    'حساب إجمالي المنتجات بالقطعة',
    'التحقق من صحة ضرب كمية القطع بسعر الوحدة (3 قطع × 120 دج)',
    () => {
      const total = calculateItemTotal(120, 3);
      return {
        passed: total === 360,
        expected: '360 دج',
        actual: `${total} دج`,
      };
    }
  );

  runTest(
    'calc-weight-kg',
    'حساب إجمالي الوزن بالكيلوغرام والكسور العشرية',
    'التحقق من حساب وزن 0.350 كغ تفاح بسعر 400 دج/كغ',
    () => {
      const total = calculateItemTotal(400, 0.35);
      return {
        passed: total === 140,
        expected: '140 دج',
        actual: `${total} دج`,
      };
    }
  );

  runTest(
    'calc-weight-grams-format',
    'تنسيق أوزان الغرامات والكيلوغرام',
    'التحقق من عرض الأوزان الأقل من 1 كغ بصيغة مفهومة (350 غرام)',
    () => {
      const formatted = formatQuantityWithUnit(0.35, 'kg');
      const passed = formatted.includes('350 غرام');
      return {
        passed,
        expected: 'يحتوي على: 350 غرام',
        actual: formatted,
      };
    }
  );

  // 2. حساب الأرباح (سعر البيع - سعر الشراء)
  runTest(
    'calc-profit',
    'حساب هامش الربح الدقيق',
    'منتج سعر شرائه 80 دج ويباع بـ 100 دج بكمية 5، الربح الصافي = 100 دج',
    () => {
      const totalRevenue = calculateItemTotal(100, 5);
      const totalCost = calculateItemCost(80, 5);
      const profit = totalRevenue - totalCost;
      return {
        passed: profit === 100,
        expected: 'الربح: 100 دج (إيراد 500 - تكلفة 400)',
        actual: `الربح: ${profit} دج`,
      };
    }
  );

  // 3. الخصم الدقيق من المخزون عند البيع
  runTest(
    'stock-deduction',
    'تحديث المخزون التلقائي عند إتمام البيع',
    'إنشاء منتج اختباري بمخزون 20 قطعة، وبيعه 4 قطع، التأكد من بقاء 16 قطعة بالمخزون',
    () => {
      const testProd = storage.saveProduct({
        name: 'منتج اختبار الخصم',
        category: 'اختبارات',
        barcode: 'TEST_STOCK_DEDUCT_' + Date.now(),
        purchasePrice: 50,
        sellingPrice: 75,
        stockQuantity: 20,
        unit: 'piece',
        minStockAlert: 5,
      });

      const saleItem: SaleItem = {
        productId: testProd.id,
        name: testProd.name,
        barcode: testProd.barcode,
        unit: testProd.unit,
        unitPrice: testProd.sellingPrice,
        purchasePrice: testProd.purchasePrice,
        quantity: 4,
        total: 300,
        totalCost: 200,
      };

      storage.createSale({
        items: [saleItem],
        paymentMethod: 'cash',
      });

      const updatedProd = storage.getProducts().find(p => p.id === testProd.id);
      const remaining = updatedProd ? updatedProd.stockQuantity : -1;

      // Clean up test product
      storage.softDeleteProduct(testProd.id);

      return {
        passed: remaining === 16,
        expected: '16 قطعة متبقية في المخزون',
        actual: `${remaining} قطعة متبقية`,
      };
    }
  );

  // 4. اختبار زيادة المخزون عند استلام بضاعة جديدة مع تحديث سعر الشراء
  runTest(
    'stock-replenishment',
    'زيادة المخزون وتحديث سعر الشراء عند استلام بضاعة',
    'إضافة 10 قطع جديدة لمنتج به 5 قطع مع تغيير سعر الشراء من 40 إلى 45 دج',
    () => {
      const prod = storage.saveProduct({
        name: 'منتج استلام بضاعة',
        category: 'اختبارات',
        barcode: 'TEST_REPLENISH_' + Date.now(),
        purchasePrice: 40,
        sellingPrice: 60,
        stockQuantity: 5,
        unit: 'piece',
        minStockAlert: 3,
      });

      storage.replenishProductStock(prod.id, 10, 45);
      const updated = storage.getProducts().find(p => p.id === prod.id);

      const passed = !!updated && updated.stockQuantity === 15 && updated.purchasePrice === 45;
      storage.softDeleteProduct(prod.id);

      return {
        passed,
        expected: 'المخزون: 15 قطعة، وسعر الشراء: 45 دج',
        actual: `المخزون: ${updated?.stockQuantity} قطعة، سعر الشراء: ${updated?.purchasePrice} دج`,
      };
    }
  );

  // 5. ربط الدين بالزبون وحساب الرصيد المتبقي
  runTest(
    'debt-recording',
    'تسجيل الفاتورة كدين على زبون وتحديث إجمالي الدين',
    'إضافة زبون بدين 0 دج، بيع بالدين بقيمة 850 دج، التأكد من أن رصيد دينه أصبح 850 دج',
    () => {
      const testCustomer = storage.saveCustomer({
        name: 'زبون اختبار الدين',
        phone: '0555999888',
        notes: 'حساب تجريبي',
      });

      const dummyProd = storage.saveProduct({
        name: 'سلعة اختبار الدين',
        category: 'اختبارات',
        barcode: 'TEST_DEBT_' + Date.now(),
        purchasePrice: 500,
        sellingPrice: 850,
        stockQuantity: 10,
        unit: 'piece',
        minStockAlert: 2,
      });

      storage.createSale({
        items: [{
          productId: dummyProd.id,
          name: dummyProd.name,
          barcode: dummyProd.barcode,
          unit: dummyProd.unit,
          unitPrice: 850,
          purchasePrice: 500,
          quantity: 1,
          total: 850,
          totalCost: 500,
        }],
        paymentMethod: 'credit',
        customerId: testCustomer.id,
        customerName: testCustomer.name,
      });

      const updatedCust = storage.getCustomers().find(c => c.id === testCustomer.id);
      const totalDebt = updatedCust ? updatedCust.totalDebt : -1;

      // Clean up
      storage.softDeleteProduct(dummyProd.id);

      return {
        passed: totalDebt === 850,
        expected: '850 دج دين مستحق على الزبون',
        actual: `${totalDebt} دج`,
      };
    }
  );

  // 6. تسديد دفعة من الدين (جزئي أو كلي)
  runTest(
    'debt-payment',
    'تسديد دفعة دين جزئية والتحقق من خصم الرصيد',
    'زبون عليه 850 دج، يسدد 350 دج، المتبقي يجب أن يكون 500 دج تمامًا',
    () => {
      const cust = storage.saveCustomer({
        name: 'زبون تسديد دفعة',
        phone: '0666111222',
        totalDebt: 850,
      });

      const pmt = storage.recordDebtPayment(cust.id, 350, 'تسديد دفعة نقدية');
      const updatedCust = storage.getCustomers().find(c => c.id === cust.id);

      const passed = !!pmt && pmt.newDebt === 500 && updatedCust?.totalDebt === 500;
      return {
        passed,
        expected: 'الدين المتبقي: 500 دج',
        actual: `الدين المتبقي: ${updatedCust?.totalDebt} دج`,
      };
    }
  );

  // 7. إرجاع السلعة أو إلغاء الفاتورة وإعادة المخزون
  runTest(
    'sale-return-restock',
    'إلغاء الفاتورة وإرجاع الكمية تلقائيًا إلى المخزون',
    'بيع قطعتين من منتج بمخزون 10 (يتبقى 8)، ثم إلغاء الفاتورة ليعود المخزون إلى 10',
    () => {
      const prod = storage.saveProduct({
        name: 'منتج اختبار الإرجاع',
        category: 'اختبارات',
        barcode: 'TEST_RETURN_' + Date.now(),
        purchasePrice: 100,
        sellingPrice: 150,
        stockQuantity: 10,
        unit: 'piece',
        minStockAlert: 2,
      });

      const sale = storage.createSale({
        items: [{
          productId: prod.id,
          name: prod.name,
          barcode: prod.barcode,
          unit: prod.unit,
          unitPrice: 150,
          purchasePrice: 100,
          quantity: 2,
          total: 300,
          totalCost: 200,
        }],
        paymentMethod: 'cash',
      });

      // Now cancel / return sale
      storage.returnOrCancelSale(sale.id, true);

      const finalProd = storage.getProducts().find(p => p.id === prod.id);
      const passed = finalProd?.stockQuantity === 10;
      storage.softDeleteProduct(prod.id);

      return {
        passed,
        expected: 'عودة المخزون إلى 10 قطع تمامًا',
        actual: `المخزون بعد الإلغاء: ${finalProd?.stockQuantity} قطع`,
      };
    }
  );

  // 8. الحذف القابل للاسترجاع (سلة المحذوفات)
  runTest(
    'soft-delete-recovery',
    'حذف عنصر ونقله لسلة المحذوفات مع إمكانية استرجاعه بضغطة زر',
    'حذف منتج مؤقتًا والتأكد من إخفائه من القائمة ووجوده في سلة المهملات، ثم استرجاعه',
    () => {
      const prod = storage.saveProduct({
        name: 'منتج سلة المحذوفات',
        category: 'اختبارات',
        barcode: 'TEST_TRASH_' + Date.now(),
        purchasePrice: 10,
        sellingPrice: 20,
        stockQuantity: 100,
        unit: 'piece',
        minStockAlert: 5,
      });

      storage.softDeleteProduct(prod.id);
      const activeList = storage.getProducts();
      const isHidden = !activeList.some(p => p.id === prod.id);

      const trashItems = storage.getTrashItems();
      const trash = trashItems.find(t => t.entityId === prod.id);
      const foundInTrash = !!trash;

      let recovered = false;
      if (trash) {
        storage.restoreTrashItem(trash.id);
        const recheckActive = storage.getProducts();
        recovered = recheckActive.some(p => p.id === prod.id);
        // Clean up
        storage.softDeleteProduct(prod.id);
      }

      return {
        passed: isHidden && foundInTrash && recovered,
        expected: 'إخفاء المنتج + وجوده في المهملات + استرجاعه بنجاح',
        actual: `مخفي: ${isHidden}، في المهملات: ${foundInTrash}، تم الاسترجاع: ${recovered}`,
      };
    }
  );

  // 9. طابور العمل دون اتصال (Offline Outbox Queue)
  runTest(
    'offline-outbox-queue',
    'العمل دون اتصال وتسجيل التغييرات في طابور المزامنة',
    'التحقق من أن أي عملية بيع أو تعديل تسجل محليًا وتضاف لطابور المزامنة التلقائي',
    () => {
      const queueBefore = storage.getOutboxQueue().length;
      storage.saveExpense({
        title: 'مصروف تجريبي لاختبار الطابور',
        category: 'other',
        amount: 250,
        date: new Date().toISOString(),
      });
      const queueAfter = storage.getOutboxQueue().length;
      const passed = queueAfter > queueBefore;

      return {
        passed,
        expected: 'زيادة عدد عناصر طابور المزامنة بعد الإضافة المحلية',
        actual: `العناصر قبل: ${queueBefore}، العناصر بعد: ${queueAfter}`,
      };
    }
  );


  // 12. رفض البيع الزائد دون تغيير المخزون أو تسجيل فاتورة.
  runTest(
    'reject-overstock-sale',
    'منع بيع كمية أكبر من المخزون المتوفر',
    'محاولة بيع 6 قطع بينما المتوفر 5؛ يجب رفض البيع والإبقاء على المخزون والفواتير كما هما',
    () => {
      const prod = storage.saveProduct({
        name: 'اختبار منع البيع الزائد', category: 'اختبارات', barcode: 'TEST_OVERSTOCK_' + Date.now(),
        purchasePrice: 10, sellingPrice: 15, stockQuantity: 5, unit: 'piece', minStockAlert: 1,
      });
      const salesBefore = storage.getSales(true).length;
      let rejected = false;
      try {
        storage.createSale({
          items: [{ productId: prod.id, name: prod.name, barcode: prod.barcode, unit: prod.unit,
            unitPrice: prod.sellingPrice, purchasePrice: prod.purchasePrice, quantity: 6,
            total: 90, totalCost: 60 }],
          paymentMethod: 'cash',
        });
      } catch { rejected = true; }
      const current = storage.getProducts().find(p => p.id === prod.id);
      const passed = rejected && current?.stockQuantity === 5 && storage.getSales(true).length === salesBefore;
      return {
        passed,
        expected: 'رفض البيع + بقاء المخزون 5 + عدم إنشاء فاتورة',
        actual: `مرفوض: ${rejected}، المخزون: ${current?.stockQuantity}، عدد الفواتير: ${storage.getSales(true).length - salesBefore}`,
      };
    }
  );

  // 13. تأكيد أن إقرار دفعة مزامنة لا يحذف عناصر أضيفت بعدها.
  runTest(
    'outbox-selective-ack',
    'الحفاظ على تغييرات المزامنة الجديدة أثناء رفع تغييرات سابقة',
    'إنشاء عنصرين في الطابور ثم إقرار الأول فقط؛ يجب أن يبقى الثاني في الطابور',
    () => {
      const first = storage.saveExpense({ title: 'اختبار طابور 1', category: 'other', amount: 1, date: new Date().toISOString() });
      const firstQueueIds = storage.getOutboxQueue().map(item => item.id);
      const second = storage.saveExpense({ title: 'اختبار طابور 2', category: 'other', amount: 2, date: new Date().toISOString() });
      const secondQueueIds = storage.getOutboxQueue().filter(item => item.data?.id === second.id).map(item => item.id);
      storage.clearOutboxQueue(firstQueueIds);
      const remaining = storage.getOutboxQueue();
      const passed = secondQueueIds.every(id => remaining.some(item => item.id === id));
      return {
        passed,
        expected: 'بقاء عناصر التغيير الثاني في الطابور بعد إقرار الأول',
        actual: `التغييرات المتبقية للعنصر الثاني: ${secondQueueIds.filter(id => remaining.some(item => item.id === id)).length}/${secondQueueIds.length}`,
      };
    }
  );

  storage.restoreStateSnapshot(originalState);
  return results;
}
