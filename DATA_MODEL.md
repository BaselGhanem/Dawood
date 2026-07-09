# Data Model - Official Version

## users

Fields:
- fullName
- username
- email
- role
- status
- normalMonthlySalary
- salaryBalance: رصيد راتب تراكمي سابق؛ موجب يعني للموظف، وسالب يعني عليه.
- cashBalance
- cliqBalance
- advancesBalance
- assignedWarehouseId
- permissions

## internalTransfers

Workflow:
1. sender sends transfer.
2. amount is deducted from sender immediately.
3. status = pending.
4. receiver gets notification.
5. receiver accepts: amount is added to receiver.
6. receiver rejects: amount is returned to sender.

Fields:
- transferNumber
- date
- senderId / senderName
- receiverId / receiverName
- balanceField: cashBalance or cliqBalance
- amount
- status: pending / confirmed / rejected
- requiresReceiverApproval

## employeeAdvances

- employeeId
- date
- source
- amount
- fromOwnCashbox
- status

When source is own cashbox:
- cashBalance decreases.
- advancesBalance increases.
- remaining salary decreases.

## salaries

Cumulative formula:

salaryBalanceAfter = previousSalaryBalance + entitlement - paidAmount

entitlement = normalMonthlySalary + bonus - deductions - advancesDeducted

After posting salary:
- advancesBalance resets to 0 because it was deducted in the salary cycle.
- salaryBalance becomes salaryBalanceAfter.
- cashBalance decreases by paidAmount.

## systemLogs

Every add/edit/delete/financial movement/login/bootstrap action is logged.

## official seed

Contains only:
- settings/company
- users: Dawood, Moatasem, Khader
- warehouses/main

No demo customers, items, suppliers, invoices, or movements.
