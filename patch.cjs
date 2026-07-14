const fs = require('fs');

function patchController(file, searchRegex, replaceRegex) {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(searchRegex, replaceRegex);
    fs.writeFileSync(file, content);
}

// 1. Patch Backend Controllers (inertia_location -> redirect)
const backendFiles = [
    'app/Http/Controllers/Marketing/PurchaseOrderInController.php',
    'app/Http/Controllers/Marketing/PurchaseRequirementController.php',
    'app/Http/Controllers/Marketing/PurchaseOrderController.php'
];

backendFiles.forEach(file => {
    patchController(
        file,
        /return inertia_location\((.*?)\);/g,
        'return redirect($1);'
    );
});

// 2. Patch Frontend (isSubmitting to false)
const { execSync } = require('child_process');
const frontendFiles = execSync('find resources/js/pages -name "*.jsx"').toString().split('\n').filter(Boolean);

frontendFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Find missing onFinish around router.put and router.post
    // Many use `onStart: () => setIsSubmitting(true),`
    // If it doesn't already have onFinish, we inject it.
    content = content.replace(/(onStart:\s*\(\)\s*=>\s*setIsSubmitting\(true\),?)/g, (match) => {
        return match + '\n                onFinish: () => setIsSubmitting(false),';
    });
    
    // There are some places that use setIsSaving(true)
    content = content.replace(/(onStart:\s*\(\)\s*=>\s*setIsSaving\(true\),?)/g, (match) => {
        return match + '\n                onFinish: () => setIsSaving(false),';
    });

    if (content !== original) {
        fs.writeFileSync(file, content);
    }
});
