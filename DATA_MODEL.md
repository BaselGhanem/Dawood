# Firebase Data Model — نظام إدارة الزيوت والبضاعة

## users
fullName, username, email, role, status, startDate, normalMonthlySalary, assignedWarehouseId, cashBalance, cliqBalance, advancesBalance, createdBy, createdAt, updatedAt, lastLogin.

## warehouses
warehouseCode, warehouseName, type: main|vehicle, repId, managerId, status.

## items
itemCode, itemName, category, unit, costPrice, standardSellingPrice, shortagePrice, minimumStock, supplierId, status, stock: { warehouseId: quantity }.

## inventoryMovements
movementNumber, date, itemId, warehouseId, fromWarehouseId, toWarehouseId, quantity, balanceBefore, balanceAfter, reason, notes, createdBy.

## manufacturingRecipes
recipeName, finalItemId, outputQuantity, rawMaterials[{itemId, quantity}], wastePercent, laborCost, overheadCost, status.

## productionOrders
productionNumber, date, recipeId, finalItemId, outputQuantity, totalCost, unitCost, rawMaterials, status.

## salesInvoices
invoiceNumber, date, sellerId, customerId, warehouseId, saleType, items[{itemId, quantity, price}], total, paidAmount, remainingDebt, dueDate, status.

## customerDebts / collections
customerDebts: customerId, repId, invoiceId, originalAmount, paidAmount, remainingAmount, dueDate, status.
collections: customerDebtId, invoiceId, customerId, repId, amount, method, date, status.

## purchaseInvoices / supplierDebts
purchaseInvoices: purchaseNumber, supplierId, items, total, paidAmount, paymentType, status.
supplierDebts: supplierId, purchaseId, originalAmount, paidAmount, remainingAmount, status.

## finance collections
cashDeliveries, internalTransfers, employeeAdvances, salaries, vehicleExpenses.

## audit
systemLogs: actionType, userName, userRole, module, oldValue, newValue, relatedDocumentId, notes, userAgent, createdAt.
