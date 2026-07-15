import re

with open('/root/isystem-1/app/Http/Controllers/Marketing/PurchaseOrderInController.php', 'r') as f:
    code = f.read()

# 1. Update data() method to pass prefix
code = re.sub(
    r'\$data = \$this->getPurchaseOrderInData\(\s*\$search,\s*\$perPage,\s*\$statusFilter,\s*\$page,\s*\$isPartial,\s*\$summaryOnly,\s*\$summaryScope,\s*\$rowsOnly,\s*\$paginationOnly,\s*\$dateFilter,\s*\$startDate,\s*\$endDate\s*\);',
    r'$prefix = $this->resolveDatabasePrefix($request);\n        $data = $this->getPurchaseOrderInData(\n            $search,\n            $perPage,\n            $statusFilter,\n            $page,\n            $isPartial,\n            $summaryOnly,\n            $summaryScope,\n            $rowsOnly,\n            $paginationOnly,\n            $dateFilter,\n            $startDate,\n            $endDate,\n            $prefix\n        );',
    code
)

# 2. Update getPurchaseOrderInData signature
code = re.sub(
    r'\$endDate = \'\'\n    \) {\n        return \(function \(\) use \(\$search, \$perPage, \$statusFilter, \$page, \$isPartial, \$summaryOnly, \$summaryScope, \$rowsOnly, \$paginationOnly, \$dateFilter, \$startDate, \$endDate\) {',
    r"$endDate = '',\n        $prefix = ''\n    ) {\n        return (function () use ($search, $perPage, $statusFilter, $page, $isPartial, $summaryOnly, $summaryScope, $rowsOnly, $paginationOnly, $dateFilter, $startDate, $endDate, $prefix) {",
    code
)

# 3. Update export() method
code = re.sub(
    r'\$purchaseOrders = DB::table\(\'tb_poin\'\)\n            ->whereDate\(\'created_at',
    r'$prefix = $this->resolveDatabasePrefix($request);\n\n        $purchaseOrders = DB::table(\'tb_poin\')\n            ->where(\'kode_poin\', \'like\', $prefix . \'.POIN-%\')\n            ->whereDate(\'created_at',
    code
)

# 4. Now replace tb_poin queries INSIDE getPurchaseOrderInData
# We capture the closure body and run replaces on it.
closure_match = re.search(r'(return \(function \(\) use \(.*?, \$prefix\) \{)(.*?)(    \}\)\(\);\n    \})', code, re.DOTALL)
if closure_match:
    prefix, body, suffix = closure_match.groups()
    body = body.replace(
        "DB::table('tb_poin as pr_p')",
        "DB::table('tb_poin as pr_p')->where('pr_p.kode_poin', 'like', $prefix . '.POIN-%')"
    )
    body = body.replace(
        "DB::table('tb_poin')",
        "DB::table('tb_poin')->where('kode_poin', 'like', $prefix . '.POIN-%')"
    )
    body = body.replace(
        "DB::table('tb_poin as p')",
        "DB::table('tb_poin as p')->where('p.kode_poin', 'like', $prefix . '.POIN-%')"
    )
    body = body.replace(
        "join('tb_poin as p', function ($join) {",
        "join('tb_poin as p', function ($join) use ($prefix) {\n                            $join->where('p.kode_poin', 'like', $prefix . '.POIN-%');"
    )
    
    code = code[:closure_match.start()] + prefix + body + suffix + code[closure_match.end():]

with open('/root/isystem-1/app/Http/Controllers/Marketing/PurchaseOrderInController.php', 'w') as f:
    f.write(code)

print("Patched successfully")
