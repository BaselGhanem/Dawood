# Dawood ERP Data Model

## Core Collections

- `users`: حسابات المستخدمين، الصلاحيات، أرصدة الصندوق، CliQ، السلف، ورصيد الراتب التراكمي.
- `loginAliases`: ربط اسم المستخدم بالبريد الإلكتروني لتسجيل الدخول باسم مختصر.
- `settings`: إعدادات الشركة.
- `warehouses`: المستودعات والسيارات.
- `items`: الأصناف وأرصدة المخزون حسب المستودع.
- `inventoryMovements`: كل حركة مخزون.
- `salesInvoices`: فواتير البيع.
- `customerDebts`: ذمم العملاء.
- `collections`: التحصيلات.
- `cashDeliveries`: تسليم النقد بين المستخدمين/الصندوق.
- `internalTransfers`: تحويلات داخلية بين صناديق المستخدمين.
- `employeeAdvances`: السلف والاقتطاعات.
- `salaries`: كشوف الرواتب التراكمية.
- `vehicleExpenses`: مصروفات السيارات.
- `stockCounts`: جرد السيارات وفروقات النقص.
- `systemLogs`: سجل حركات قابل للفلترة.
- `notifications`: إشعارات المستخدمين.

## Balance Logic

### Internal Transfer

1. عند الإرسال: يخصم المبلغ من المرسل فوراً.
2. الحالة تصبح `pending`.
3. المستلم فقط يوافق أو يرفض.
4. عند الموافقة: يضاف المبلغ إلى المستلم.
5. عند الرفض: يرجع المبلغ إلى المرسل.

### Cash Delivery

1. عند إنشاء طلب التسليم: يخصم المبلغ من المرسل كرصيد معلق.
2. المستلم فقط يؤكد أو يرفض.
3. عند التأكيد: يضاف المبلغ إلى صندوق المستلم.
4. عند الرفض: يرجع المبلغ إلى المرسل.

### Advance

السلفة الذاتية تخصم من `cashBalance` لصاحب الحساب وتزيد `advancesBalance` عليه.

### Salary

`salaryBalanceAfter = previousSalaryBalance + baseSalary + bonus - deductions - advancesBalance - paidAmount`

عند الترحيل:

- يتم تصفير `advancesBalance` للموظف.
- يتم تحديث `salaryBalance` بالقيمة الجديدة.
- إذا تم اختيار صندوق صرف، يتم خصم `paidAmount` من صندوق الصرف وليس من صندوق الموظف.
