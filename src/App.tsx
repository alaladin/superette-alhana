/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Customer, DebtPayment, Expense, Product, Sale, StoreInfo, TrashItem } from './types';
import { storage } from './lib/storage';
import { syncEngine } from './lib/syncEngine';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { OfflineBanner } from './components/common/OfflineBanner';
import { CashierView } from './components/pos/CashierView';
import { ProductListView } from './components/products/ProductListView';
import { CustomerListView } from './components/customers/CustomerListView';
import { ExpenseListView } from './components/expenses/ExpenseListView';
import { ReportsView } from './components/reports/ReportsView';
import { TrashView } from './components/trash/TrashView';
import { DevicePairingModal } from './components/pairing/DevicePairingModal';
import { AutomatedTestsModal } from './components/tests/AutomatedTestsModal';
import { ToastContainer } from './components/common/ToastContainer';

export default function App() {
  const [activeView, setActiveView] = useState<string>('pos');

  // Application Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(storage.getState().storeInfo);

  // Reload state from local storage engine
  const refreshAllState = useCallback(() => {
    const state = storage.getState();
    setProducts(storage.getProducts());
    setSales(storage.getSales());
    setCustomers(storage.getCustomers());
    setDebtPayments(state.debtPayments.filter(p => !p.isDeleted));
    setExpenses(storage.getExpenses());
    setTrashItems(storage.getTrashItems());
    setStoreInfo(state.storeInfo);
  }, []);

  useEffect(() => {
    refreshAllState();

    // Subscribe to multi-device sync engine
    const unsubscribe = syncEngine.subscribe(() => {
      refreshAllState();
    });

    return unsubscribe;
  }, [refreshAllState]);

  // Product Actions
  const handleSaveProduct = (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    storage.saveProduct(productData);
    refreshAllState();
  };

  const handleReplenishStock = (productId: string, addedQty: number, newPurchasePrice?: number) => {
    storage.replenishProductStock(productId, addedQty, newPurchasePrice);
    refreshAllState();
  };

  const handleDeleteProduct = (productId: string) => {
    storage.softDeleteProduct(productId);
    refreshAllState();
  };

  // Customer Actions
  const handleSaveCustomer = (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalDebt'> & { id?: string; totalDebt?: number }) => {
    storage.saveCustomer(customerData);
    refreshAllState();
  };

  const handleRecordPayment = (customerId: string, amount: number, notes?: string) => {
    storage.recordDebtPayment(customerId, amount, notes);
    refreshAllState();
  };

  const handleDeleteCustomer = (customerId: string) => {
    storage.softDeleteCustomer(customerId);
    refreshAllState();
  };

  // Expense Actions
  const handleSaveExpense = (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    storage.saveExpense(expenseData);
    refreshAllState();
  };

  const handleDeleteExpense = (expenseId: string) => {
    storage.softDeleteExpense(expenseId);
    refreshAllState();
  };

  // Sales Actions (Return / Cancel)
  const handleReturnSale = (saleId: string) => {
    storage.returnOrCancelSale(saleId, false);
    refreshAllState();
  };

  // Trash Actions (Recovery & Permanent Delete)
  const handleRestoreTrashItem = (trashItemId: string) => {
    storage.restoreTrashItem(trashItemId);
    refreshAllState();
  };

  const handlePermanentDeleteTrashItem = (trashItemId: string) => {
    storage.permanentlyDeleteTrashItem(trashItemId);
    refreshAllState();
  };

  // Store Settings Update
  const handleUpdateStoreInfo = (info: Partial<StoreInfo>) => {
    storage.updateStoreInfo(info);
    refreshAllState();
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-['Tajawal',sans-serif]">
      {/* Floating Notifications */}
      <ToastContainer />

      {/* Top Header */}
      <Header
        storeInfo={storeInfo}
        activeView={activeView}
        setActiveView={setActiveView}
        trashCount={trashItems.length}
      />

      {/* Navigation Tabs (Top on Desktop, Bottom on Mobile) */}
      <Navigation
        activeView={activeView}
        setActiveView={setActiveView}
        trashCount={trashItems.length}
      />

      {/* Offline Connectivity Warning Banner */}
      <OfflineBanner />

      {/* Main View Area */}
      <main className="flex-1 p-3 sm:p-4 max-w-7xl mx-auto w-full pb-20 md:pb-6">
        {activeView === 'pos' && (
          <CashierView
            storeInfo={storeInfo}
            onRefreshData={refreshAllState}
          />
        )}

        {activeView === 'products' && (
          <ProductListView
            products={products}
            onSaveProduct={handleSaveProduct}
            onReplenishStock={handleReplenishStock}
            onDeleteProduct={handleDeleteProduct}
          />
        )}

        {activeView === 'customers' && (
          <CustomerListView
            customers={customers}
            sales={sales}
            debtPayments={debtPayments}
            onSaveCustomer={handleSaveCustomer}
            onRecordPayment={handleRecordPayment}
            onDeleteCustomer={handleDeleteCustomer}
          />
        )}

        {activeView === 'expenses' && (
          <ExpenseListView
            expenses={expenses}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}

        {activeView === 'reports' && (
          <ReportsView
            sales={sales}
            expenses={expenses}
            products={products}
            customers={customers}
            debtPayments={debtPayments}
            storeInfo={storeInfo}
            onReturnSale={handleReturnSale}
          />
        )}

        {activeView === 'pairing' && (
          <DevicePairingModal
            storeInfo={storeInfo}
            onUpdateStoreInfo={handleUpdateStoreInfo}
            onRefreshData={refreshAllState}
          />
        )}

        {activeView === 'trash' && (
          <TrashView
            trashItems={trashItems}
            onRestore={handleRestoreTrashItem}
            onPermanentDelete={handlePermanentDeleteTrashItem}
          />
        )}

        {activeView === 'tests' && (
          <AutomatedTestsModal />
        )}
      </main>
    </div>
  );
}
