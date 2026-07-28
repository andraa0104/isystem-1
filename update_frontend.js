const fs = require('fs');
const file = '/root/isystem-1/resources/js/pages/marketing/purchase-order-in/index.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /const fetchPoInSummaryScope = async \(scope\) => {\n        setSummaryLoading\(\(prev\) => \({ \.\.\.prev, \[scope\]: true }\)\);\n        try {\n            const queryParams = new URLSearchParams\({\n                search: '',\n                per_page: '5',\n                status: 'all',\n                date_filter: 'all',\n                page: '1',\n                summary_only: '1',\n                summary_scope: scope,\n            }\);/,
    `const fetchPoInSummaryScope = async (scope, dateFilter = 'all') => {
        setSummaryLoading((prev) => ({ ...prev, [scope]: true }));
        try {
            const queryParams = new URLSearchParams({
                search: '',
                per_page: '5',
                status: 'all',
                date_filter: dateFilter,
                page: '1',
                summary_only: '1',
                summary_scope: scope,
            });`
);

content = content.replace(
    /const fetchPoInSummary = \(\) => {\n        \[\n            'outstanding_pr',\n            'outstanding_do',\n            'sisa_pr',\n            'sisa_do',\n            'realized_pr',\n            'realized_do',\n            'total',\n        \]\.forEach\(\(scope\) => fetchPoInSummaryScope\(scope\)\);\n    };/,
    `const fetchPoInSummary = (scopes) => {
        const scopesToFetch = scopes || [
            'outstanding_pr',
            'outstanding_do',
            'sisa_pr',
            'sisa_do',
            'realized_pr',
            'realized_do',
            'total',
        ];
        scopesToFetch.forEach((scope) => {
            if (scope === 'realized_pr' || scope === 'realized_do') {
                fetchPoInSummaryScope(scope, realizedPeriod);
            } else {
                fetchPoInSummaryScope(scope, 'all');
            }
        });
    };`
);

content = content.replace(
    /const realizedPeriodKey = useMemo\(\(\) => {\n        if \(realizedPeriod === 'this_week'\) return 'week';\n        if \(realizedPeriod === 'this_month'\) return 'month';\n        if \(realizedPeriod === 'this_year'\) return 'year';\n        return realizedPeriod;\n    }, \[realizedPeriod\]\);\n\n    const realizedPrCount = Number\(\n        summary\.realized_pr_counts\?\.\[realizedPeriodKey\] \?\? 0,\n    \);\n    const realizedDoCount = Number\(\n        summary\.realized_do_counts\?\.\[realizedPeriodKey\] \?\? 0,\n    \);/,
    `const realizedPrCount = Number(summary.realized_pr ?? 0);
    const realizedDoCount = Number(summary.realized_do ?? 0);
    
    useEffect(() => {
        fetchPoInSummary(['realized_pr', 'realized_do']);
    }, [realizedPeriod]);`
);


// Note: in fetchPoInSummary we need to make sure realizedPeriod is available in the scope! 
// Let's just write the fix exactly.
fs.writeFileSync(file, content);
